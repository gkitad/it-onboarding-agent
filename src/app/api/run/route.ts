import { z } from "zod";
import { advance, decide, newRun, type Emit } from "@/lib/agent";
import { sign, verify, type RunState } from "@/lib/state";

export const maxDuration = 120;

const Signed = z.object({ state: z.unknown(), sig: z.string() });

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    request: z
      .string()
      .trim()
      .min(15, "Describe who is starting or leaving, their department and manager.")
      .max(800, "Keep the request under 800 characters."),
    prior: Signed.optional(),
  }),
  z.object({ action: z.literal("approve") }).merge(Signed),
  z.object({ action: z.literal("deny") }).merge(Signed),
]);

// Best-effort limit per server instance on new runs, so the public demo
// can't run up the API bill. Pair it with a spend limit in the Claude Console.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_RUNS = 6;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  const limited = recent.length >= MAX_RUNS;
  if (!limited) recent.push(now);
  hits.set(ip, recent);
  return limited;
}

const json = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  let body;
  try {
    body = Body.safeParse(await request.json());
  } catch {
    return json("The request wasn't valid JSON.", 400);
  }
  if (!body.success) return json(body.error.issues[0]?.message ?? "Invalid request.", 400);
  const data = body.data;

  if (process.env.MOCK_AGENT !== "1" && !process.env.ANTHROPIC_API_KEY) {
    return json("The agent isn't configured yet: ANTHROPIC_API_KEY is missing on the server.", 503);
  }

  let state: RunState;
  if (data.action === "start") {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (rateLimited(ip)) return json("You've started several runs in a short time. Wait a few minutes and try again.", 429);
    let directory;
    if (data.prior) {
      if (!verify(data.prior.state, data.prior.sig)) return json("The saved directory couldn't be verified. Reset the demo and try again.", 400);
      if (!data.prior.state.done) return json("Finish the current run before starting another.", 409);
      directory = data.prior.state.directory;
    }
    state = newRun(data.request, directory);
  } else {
    if (!verify(data.state, data.sig)) return json("This run couldn't be verified. Reset the demo and try again.", 400);
    state = data.state;
    if (!state.pending) return json("There's nothing waiting for approval.", 409);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (msg) => controller.enqueue(encoder.encode(JSON.stringify(msg) + "\n"));
      try {
        if (data.action === "start") await advance(state, emit);
        else await decide(state, data.action === "approve", emit);
      } catch (e) {
        console.error("agent run failed", e);
        const status = e instanceof Error && "status" in e ? Number((e as { status: number }).status) : 0;
        const message =
          status === 429 || status === 529
            ? "The AI service is busy right now. Try again in a minute."
            : "The agent hit an error and stopped. What it completed is in the audit log.";
        const event = { id: `err${Date.now()}`, type: "error" as const, message };
        state.events.push(event);
        state.done = true;
        state.pending = null;
        emit({ type: "event", event });
      }
      controller.enqueue(encoder.encode(JSON.stringify({ type: "final", state, sig: sign(state) }) + "\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
