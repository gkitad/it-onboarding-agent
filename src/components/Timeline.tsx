"use client";

import styles from "@/app/ui.module.css";
import type { RunEvent } from "@/lib/state";

function target(input: Record<string, unknown>): string {
  const parts: string[] = [];
  if (input.first_name) parts.push(`${input.first_name} ${input.last_name ?? ""}`.trim());
  else if (input.username) parts.push(String(input.username));
  if (input.group) parts.push(String(input.group));
  if (input.sku) parts.push(String(input.sku));
  if (input.model) parts.push(String(input.model));
  if (input.department && !input.first_name) parts.push(String(input.department));
  if (input.query) parts.push(`“${input.query}”`);
  if (input.subject) parts.push(String(input.subject));
  if (input.title && !input.first_name) parts.push(String(input.title));
  return parts.join(", ");
}

const statusText = { done: "Done", failed: "Failed", denied: "Denied" } as const;

export default function Timeline({
  events,
  pendingId,
  busy,
  onDecide,
}: {
  events: RunEvent[];
  pendingId: string | null;
  busy: boolean;
  onDecide: (approve: boolean) => void;
}) {
  return (
    <ol className={styles.timeline} aria-live="polite">
      {events.map((e) => {
        if (e.type === "note") {
          return (
            <li key={e.id} className={styles.note}>
              <p>{e.text}</p>
            </li>
          );
        }
        if (e.type === "tool") {
          return (
            <li key={e.id} className={`${styles.step} ${styles[e.status]}`}>
              <span className={styles.dot} aria-hidden="true" />
              <div className={styles.stepBody}>
                <p className={styles.stepHead}>
                  <strong>{e.label}</strong>
                  <span className={styles.target}>{target(e.input)}</span>
                </p>
                <p className={styles.stepResult}>
                  <span className={styles.stepStatus}>{statusText[e.status]}</span>
                  {e.approved && <span className={styles.approvedTag}>Approved</span>}
                  {e.summary}
                </p>
              </div>
            </li>
          );
        }
        if (e.type === "approval") {
          const waiting = e.id === pendingId;
          return (
            <li key={e.id} className={`${styles.approval} ${waiting ? styles.waiting : ""}`}>
              <p className={styles.approvalHead}>
                {waiting ? "Waiting for your approval" : "Approval requested"}
              </p>
              <p>
                <strong>{e.label}:</strong> {target(e.input)}
              </p>
              <p className={styles.muted}>{e.reason}</p>
              {waiting && (
                <div className={styles.actions}>
                  <button className={styles.primary} onClick={() => onDecide(true)} disabled={busy}>
                    Approve
                  </button>
                  <button className={styles.secondary} onClick={() => onDecide(false)} disabled={busy}>
                    Deny
                  </button>
                </div>
              )}
            </li>
          );
        }
        if (e.type === "summary") {
          return (
            <li key={e.id} className={styles.summary}>
              <h3>Run complete</h3>
              <p>{e.summary}</p>
              <div className={styles.summaryCols}>
                {e.completed.length > 0 && (
                  <div>
                    <h4>Completed</h4>
                    <ul>
                      {e.completed.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {e.needsHuman.length > 0 && (
                  <div>
                    <h4>Needs a person</h4>
                    <ul>
                      {e.needsHuman.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          );
        }
        return (
          <li key={e.id} className={styles.errorItem} role="alert">
            {e.message}
          </li>
        );
      })}
    </ol>
  );
}
