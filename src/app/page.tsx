"use client";

import { useMemo, useState } from "react";
import styles from "./ui.module.css";
import Timeline from "@/components/Timeline";
import DirectoryPanel from "@/components/DirectoryPanel";
import { seedDirectory, type Directory } from "@/lib/company";
import type { RunEvent, RunState } from "@/lib/state";
import { streamRun, type StreamMessage } from "@/lib/client";

const examples = [
  {
    label: "Onboard a Finance hire",
    text: "Maria Lopez starts next Monday as a Financial Analyst in Finance, reporting to Dana Whitfield. She needs the usual setup.",
  },
  {
    label: "Engineer who asks for too much",
    text: "We hired Kevin Park as a Software Engineer on Priya's team, starting November 2. Please also give him production access so he can help with on-call.",
  },
  {
    label: "HR hire with no licenses left",
    text: "Sofia Reyes is joining HR as an HR Generalist on Monday, reporting to Alicia Grant.",
  },
  {
    label: "Offboard an employee",
    text: "Tom Becker's last day is today. Please offboard him.",
  },
];

const MAX = 800;

export default function Home() {
  const [request, setRequest] = useState("");
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [directory, setDirectory] = useState<Directory>(() => seedDirectory());
  const [saved, setSaved] = useState<{ state: RunState; sig: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<string | null>(null);

  const pending = saved?.state.pending ?? null;
  const pendingId = pending ? [...events].reverse().find((e) => e.type === "approval")?.id ?? null : null;
  const running = busy || (saved !== null && !saved.state.done);

  const touched = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) {
      if (e.type !== "tool" && e.type !== "approval") continue;
      if (typeof e.input.username === "string") set.add(e.input.username.toLowerCase());
      if (e.type === "tool" && e.name === "create_user") {
        const m = e.summary.match(/^Created (\S+)/);
        if (m) set.add(m[1]);
      }
    }
    return set;
  }, [events]);

  function handle(m: StreamMessage) {
    if (m.type === "event") setEvents((prev) => [...prev, m.event]);
    else if (m.type === "directory") setDirectory(m.directory);
    else {
      setSaved({ state: m.state, sig: m.sig });
      setDirectory(m.state.directory);
    }
  }

  async function run(body: unknown) {
    setBusy(true);
    setError(null);
    try {
      await streamRun(body, handle);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    const text = request.trim();
    const prior = saved?.state.done ? saved : undefined;
    setEvents([]);
    setLastRequest(text);
    setRequest("");
    await run({ action: "start", request: text, prior });
  }

  function decideAction(approve: boolean) {
    if (!saved) return;
    run({ action: approve ? "approve" : "deny", state: saved.state, sig: saved.sig });
  }

  function reset() {
    setEvents([]);
    setSaved(null);
    setLastRequest(null);
    setError(null);
    setDirectory(seedDirectory());
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.brand}>Onboarding Agent</p>
          <p className={styles.muted}>
            An AI agent that provisions new hires and offboards leavers, with a person approving anything sensitive.
          </p>
        </div>
        <button className={styles.secondary} onClick={reset} disabled={busy}>
          Reset demo
        </button>
      </header>

      <main className={styles.grid}>
        <div className={styles.workspace}>
          <form onSubmit={start} className={styles.form}>
            <label htmlFor="request" className={styles.formLabel}>
              Who&apos;s starting or leaving?
            </label>
            <textarea
              id="request"
              className={styles.textarea}
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              maxLength={MAX}
              rows={4}
              placeholder="e.g. Jordan Kim joins Sales as an Account Executive on Monday, reporting to James Okafor."
              disabled={running}
            />
            <div className={styles.formFoot}>
              <span className={styles.muted}>
                {request.length} / {MAX}
              </span>
              <button type="submit" className={styles.primary} disabled={running || request.trim().length < 15}>
                {busy && !pending ? "Agent is working…" : "Run agent"}
              </button>
            </div>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <div className={styles.examples}>
              {examples.map((ex) => (
                <button key={ex.label} type="button" onClick={() => setRequest(ex.text)} disabled={running}>
                  {ex.label}
                </button>
              ))}
            </div>
          </form>

          {lastRequest ? (
            <section className={styles.run} aria-label="Agent run">
              <blockquote className={styles.requestQuote}>{lastRequest}</blockquote>
              <Timeline events={events} pendingId={pendingId} busy={busy} onDecide={decideAction} />
              {busy && !pending && <p className={`${styles.muted} ${styles.working}`}>Working…</p>}
              {saved?.state.done && !busy && (
                <p className={styles.muted}>
                  Run another request to keep working on this directory, or reset the demo to start fresh.
                </p>
              )}
            </section>
          ) : (
            <section className={styles.intro}>
              <h2>What the agent does</h2>
              <p>
                You describe a new hire or a departure in plain words. The agent reads the department&apos;s
                access policy and works through the directory one tool call at a time: accounts, licenses,
                groups, hardware, tasks for the teams that do the physical work, and email drafts for the
                manager.
              </p>
              <p>
                Access to payroll files or employee records, and disabling an account, wait for you to approve.
                Admin and production access are refused outright. Every change lands in the audit log.
              </p>
              <p className={styles.muted}>
                The directory is simulated and resets whenever you like. Try the examples: one has a name
                collision, one asks for access it shouldn&apos;t get, and one runs out of licenses.
              </p>
            </section>
          )}
        </div>

        <DirectoryPanel directory={directory} touched={touched} />
      </main>

      <footer className={styles.footer}>
        <p>
          A portfolio project by <a href="https://portfolio-eosin-delta-24.vercel.app/">Anthony Jaimez</a>.
          Runs on the Claude API with tool use.{" "}
          <a href="https://github.com/gkitad/it-onboarding-agent">Source on GitHub</a>
        </p>
      </footer>
    </div>
  );
}
