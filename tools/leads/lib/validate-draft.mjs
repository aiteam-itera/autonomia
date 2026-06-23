import { CATALOG_TOKENS } from "./catalog.mjs";
import { detectInjection } from "./sanitize.mjs";

export const DRAFT_LIMITS = { min: 200, max: 4000 };

// Internal strings that must never appear in an outgoing draft — leaking any of
// them means the system prompt / guardrail bled through (ITEA-2787 control 4).
const LEAK_MARKERS = [
  /lead_input/i,
  /datos no confiables/i,
  /regla de seguridad/i,
  /system\s*prompt/i,
  /these instructions/i,
];

function normalize(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(s) {
  const n = normalize(s);
  return n ? n.split(" ") : [];
}

// True if the draft reproduces a literal run from one of the lead's own open
// answers — strong evidence of genuine citation rather than template filler.
function citesOpenAnswer(draftNorm, openValues, n = 4) {
  for (const val of openValues) {
    const w = words(val);
    if (w.length === 0) continue;
    if (w.length < n) {
      if (draftNorm.includes(w.join(" "))) return true;
      continue;
    }
    for (let i = 0; i + n <= w.length; i++) {
      if (draftNorm.includes(w.slice(i, i + n).join(" "))) return true;
    }
  }
  return false;
}

// Validate a generated draft before it can move to the send step.
//   draft      — the recommendation Markdown the agent wrote
//   openValues — array of the lead's sanitized open-answer strings
export function validateDraft(draft, openValues = []) {
  const errors = [];
  const warnings = [];
  const text = String(draft ?? "");

  if (text.trim().length < DRAFT_LIMITS.min) errors.push("too_short");
  if (text.length > DRAFT_LIMITS.max) errors.push("too_long");

  for (const re of LEAK_MARKERS) {
    if (re.test(text)) errors.push("system_prompt_leak");
  }

  const reflected = detectInjection(text);
  if (reflected.length) errors.push("reflected_injection:" + reflected.join(","));

  const hasCatalog = CATALOG_TOKENS.some((tok) => text.toLowerCase().includes(tok.toLowerCase()));
  if (!hasCatalog) errors.push("no_catalog_reference");

  if (!citesOpenAnswer(normalize(text), openValues)) errors.push("no_literal_citation");

  if (!/##\s*Tu plan AutonomIA/i.test(text)) warnings.push("missing_expected_heading");

  return { ok: errors.length === 0, errors: [...new Set(errors)], warnings };
}
