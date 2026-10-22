"use client";

import { useState } from "react";
import styles from "@/app/ui.module.css";
import type { Directory } from "@/lib/company";

const TABS = ["People", "Licenses & hardware", "Tasks & drafts", "Audit log"] as const;
type Tab = (typeof TABS)[number];

const statusClass = {
  Active: styles.sActive,
  Disabled: styles.sDisabled,
  "Pending start": styles.sPending,
} as const;

const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

export default function DirectoryPanel({ directory, touched }: { directory: Directory; touched: Set<string> }) {
  const [tab, setTab] = useState<Tab>("People");
  const sensitive = new Set(directory.groups.filter((g) => g.sensitive).map((g) => g.name));

  return (
    <section className={styles.panel} aria-labelledby="dir-title">
      <div className={styles.panelHead}>
        <h2 id="dir-title">{directory.company} directory</h2>
        <p className={styles.muted}>Simulated. Changes here are what the agent did.</p>
      </div>

      <div className={styles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={styles.tab}
            onClick={() => setTab(t)}
          >
            {t}
            {t === "Audit log" && directory.audit.length > 0 && (
              <span className={styles.count}>{directory.audit.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.panelBody} role="tabpanel">
        {tab === "People" && (
          <ul className={styles.people}>
            {[...directory.users]
              .sort((a, b) => Number(touched.has(b.username)) - Number(touched.has(a.username)))
              .map((u) => (
                <li key={u.username} className={touched.has(u.username) ? styles.touched : undefined}>
                  <div className={styles.personHead}>
                    <div>
                      <p className={styles.personName}>{u.displayName}</p>
                      <p className={styles.muted}>
                        {u.username}, {u.title}, {u.department}
                      </p>
                    </div>
                    <span className={`${styles.pill} ${statusClass[u.status]}`}>{u.status}</span>
                  </div>
                  <p className={styles.chips}>
                    {u.groups.length === 0 && <span className={styles.muted}>No groups</span>}
                    {u.groups.map((g) => (
                      <span key={g} className={`${styles.chip} ${sensitive.has(g) ? styles.chipSensitive : ""}`}>
                        {g}
                      </span>
                    ))}
                  </p>
                  <p className={styles.meta}>
                    {u.licenses.join(", ") || "No license"}
                    {u.assets.length > 0 && <> / {u.assets.join(", ")}</>}
                    {u.startDate && <> / starts {u.startDate}</>}
                  </p>
                </li>
              ))}
          </ul>
        )}

        {tab === "Licenses & hardware" && (
          <div className={styles.stack}>
            <table className={styles.table}>
              <caption>Licenses</caption>
              <thead>
                <tr>
                  <th scope="col">License</th>
                  <th scope="col">In use</th>
                  <th scope="col">Available</th>
                </tr>
              </thead>
              <tbody>
                {directory.licenses.map((l) => (
                  <tr key={l.sku}>
                    <td>{l.name}</td>
                    <td>
                      {l.assigned} / {l.total}
                    </td>
                    <td className={l.total - l.assigned === 0 ? styles.zero : undefined}>{l.total - l.assigned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className={styles.table}>
              <caption>Hardware in stock</caption>
              <thead>
                <tr>
                  <th scope="col">Model</th>
                  <th scope="col">In stock</th>
                </tr>
              </thead>
              <tbody>
                {directory.inventory.map((i) => (
                  <tr key={i.model}>
                    <td>{i.model}</td>
                    <td className={i.inStock === 0 ? styles.zero : undefined}>{i.inStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {directory.orders.length > 0 && (
              <table className={styles.table}>
                <caption>Orders</caption>
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">For</th>
                    <th scope="col">Item</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {directory.orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>{o.username}</td>
                      <td>{o.model}</td>
                      <td className={o.status === "Backordered" ? styles.zero : undefined}>{o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "Tasks & drafts" && (
          <div className={styles.stack}>
            {directory.tasks.length === 0 && directory.drafts.length === 0 && (
              <p className={styles.muted}>Tasks for people and email drafts the agent creates show up here.</p>
            )}
            {directory.tasks.map((t) => (
              <article key={t.id} className={styles.card}>
                <p className={styles.cardHead}>
                  <strong>{t.title}</strong>
                  <span className={styles.muted}>{t.id}</span>
                </p>
                <p className={styles.muted}>
                  {t.team}, due {t.due}
                </p>
                <p>{t.details}</p>
              </article>
            ))}
            {directory.drafts.map((d) => (
              <article key={d.id} className={styles.card}>
                <p className={styles.cardHead}>
                  <strong>{d.subject}</strong>
                  <span className={styles.muted}>Draft, not sent</span>
                </p>
                <p className={styles.muted}>To {d.to}</p>
                <p className={styles.emailBody}>{d.body}</p>
              </article>
            ))}
          </div>
        )}

        {tab === "Audit log" && (
          <>
            {directory.audit.length === 0 ? (
              <p className={styles.muted}>Every change the agent or an approver makes is recorded here.</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Time</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Action</th>
                      <th scope="col">Target</th>
                      <th scope="col">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...directory.audit].reverse().map((a, i) => (
                      <tr key={i} title={a.detail}>
                        <td className={styles.muted}>{time.format(new Date(a.at))}</td>
                        <td>{a.actor}</td>
                        <td>{a.action}</td>
                        <td>{a.target}</td>
                        <td className={a.result === "Failed" || a.result === "Denied" ? styles.zero : undefined}>
                          {a.result}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
