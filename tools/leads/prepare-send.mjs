#!/usr/bin/env node
// ITEA-2789 send-side orchestrator. Given a lead record and the validated draft
// the agent wrote, produce the ready-to-send message + its ledger entry. This
// is a PURE preparation step: it validates and renders but NEVER transmits and
// NEVER writes to IONOS. Actual sending (IONOS mail()) stays gated on human
// sampling (LEADS_ARCHITECTURE.md step 6) and on ITEA-3111 (SFTP creds) /
// ITEA-2402 (branded sender). The heartbeat calls prepareReco(), a human signs
// off, then the transport sends `message` and recordSend() logs the ledger row.

import { sanitizeLead } from "./lib/sanitize.mjs";
import { validateDraft } from "./lib/validate-draft.mjs";
import { renderRecoEmail } from "./lib/render-email.mjs";
import { makeSendEntry, SEND_STATUS } from "./lib/track.mjs";
import { leadKey } from "./ingest.mjs";

// Returns { ok, validation, message?, ledgerEntry, ref }. When validation fails
// the draft must not be sent; ledgerEntry records the drafted-but-unsent state
// so the audit trail keeps the rejection.
export function prepareReco(record, draft) {
  const safe = sanitizeLead(record);
  const openValues = Object.values(safe.openFields).map((f) => f.value).filter(Boolean);
  const validation = validateDraft(draft, openValues);
  const ref = leadKey(record);

  if (!validation.ok) {
    return {
      ok: false,
      validation,
      ref,
      ledgerEntry: makeSendEntry({
        ref,
        leadKey: ref,
        email: record?.email,
        status: SEND_STATUS.DRAFTED,
        auditFlags: [...safe.flags, ...validation.errors],
        ts: record?.ts,
      }),
    };
  }

  const message = renderRecoEmail({ draft, lead: record, ref });
  return {
    ok: true,
    validation,
    ref,
    message,
    ledgerEntry: makeSendEntry({
      ref,
      leadKey: ref,
      email: record?.email,
      subject: message.subject,
      status: SEND_STATUS.DRAFTED, // → SENT only after the transport confirms
      auditFlags: safe.flags,
      ts: record?.ts,
    }),
  };
}
