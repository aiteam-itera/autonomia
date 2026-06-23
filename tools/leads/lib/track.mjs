// Reply-rate instrumentation for ITEA-2789. The recommendation email is sent
// with a unique tracking ref (= the lead key) embedded in its Message-ID (see
// render-email.mjs). This module keeps an append-only ledger of sends and
// computes the primary metric: how many leads replied.
//
// How replies are correlated (operational mechanism): replies land at
// hola@itera.es (Reply-To). A reply preserves the original Message-ID in its
// References/In-Reply-To header, so harvesting those refs from the inbox yields
// the set of replied refs. computeReplyRate intersects that set with the ledger.
// The harvest step is intentionally pluggable — initially a human marks replies
// (matching the "muestreo humano" gate in LEADS_ARCHITECTURE.md); it can later
// be automated against the hola@itera.es inbox without changing this contract.

import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const SEND_STATUS = Object.freeze({ SENT: "sent", FAILED: "failed", DRAFTED: "drafted" });

// A send event is one JSON line. `ref` is the stable lead key so it matches the
// Message-ID and the ingest cursor; one logical send per ref.
export function makeSendEntry({ ref, leadKey, email, subject, status, auditFlags = [], ts }) {
  if (!ref) throw new Error("send_entry_missing_ref");
  return {
    ts: ts || new Date().toISOString(),
    ref,
    leadKey: leadKey || ref,
    email: email || null,
    subject: subject || null,
    status: status || SEND_STATUS.DRAFTED,
    auditFlags: Array.isArray(auditFlags) ? auditFlags : [],
  };
}

export function recordSend(path, entry) {
  const e = entry.ref ? entry : makeSendEntry(entry);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(e) + "\n");
  return e;
}

export function loadSends(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

// Primary metric. Only `sent` events count as delivered attempts; the latest
// event per ref wins (a ref retried after a failure counts once, as sent).
export function computeReplyRate(sends, repliedRefs = []) {
  const latest = new Map();
  for (const s of sends) {
    if (!s || !s.ref) continue;
    latest.set(s.ref, s); // file order = chronological; last write wins
  }
  const sentRefs = new Set();
  for (const [ref, s] of latest) {
    if (s.status === SEND_STATUS.SENT) sentRefs.add(ref);
  }
  const replied = new Set([...repliedRefs].filter((r) => sentRefs.has(r)));
  const sent = sentRefs.size;
  return {
    sent,
    replied: replied.size,
    rate: sent === 0 ? 0 : replied.size / sent,
    repliedRefs: [...replied],
  };
}
