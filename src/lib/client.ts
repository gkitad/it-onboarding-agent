"use client";

import type { Directory } from "./company";
import type { RunEvent, RunState } from "./state";

export type StreamMessage =
  | { type: "event"; event: RunEvent }
  | { type: "directory"; directory: Directory }
  | { type: "final"; state: RunState; sig: string };

/** POSTs to the run endpoint and calls onMessage for each NDJSON line as it arrives. */
export async function streamRun(
  body: unknown,
  onMessage: (m: StreamMessage) => void,
): Promise<void> {
  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    let message = "The run couldn't start. Try again in a moment.";
    try {
      message = (await res.json()).error ?? message;
    } catch {}
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) onMessage(JSON.parse(line) as StreamMessage);
    }
    if (done) break;
  }
}
