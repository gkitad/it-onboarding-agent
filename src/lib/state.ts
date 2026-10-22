import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { Directory } from "./company";

// The run's state travels with the browser between requests, so the server
// stays stateless. It's signed with an HMAC so a visitor can't edit the
// conversation, the directory or the step budget between calls.

export type RunEvent =
  | { id: string; type: "note"; text: string }
  | {
      id: string;
      type: "tool";
      name: string;
      label: string;
      input: Record<string, unknown>;
      status: "done" | "failed" | "denied";
      summary: string;
      approved?: boolean;
    }
  | {
      id: string;
      type: "approval";
      name: string;
      label: string;
      input: Record<string, unknown>;
      reason: string;
    }
  | { id: string; type: "summary"; summary: string; completed: string[]; needsHuman: string[] }
  | { id: string; type: "error"; message: string };

export type Pending = {
  toolUseId: string;
  name: string;
  input: Record<string, unknown>;
  reason: string;
};

export type RunState = {
  v: 1;
  request: string;
  today: string;
  directory: Directory;
  messages: Anthropic.MessageParam[];
  events: RunEvent[];
  pending: Pending | null;
  done: boolean;
  steps: number;
};

function secret(): string {
  if (process.env.STATE_SECRET) return process.env.STATE_SECRET;
  const base = process.env.ANTHROPIC_API_KEY ?? "local-development-only";
  return createHash("sha256").update(`run-state:${base}`).digest("hex");
}

export function sign(state: RunState): string {
  return createHmac("sha256", secret()).update(JSON.stringify(state)).digest("base64url");
}

export function verify(state: unknown, sig: unknown): state is RunState {
  if (typeof sig !== "string" || !state || typeof state !== "object") return false;
  const expected = Buffer.from(sign(state as RunState));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
