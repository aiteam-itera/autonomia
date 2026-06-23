// Lead free-text sanitizer — the untrusted-input layer of the recommendation
// pipeline. Lead answers are written by strangers, so they are DATA, never
// instructions. This module neutralizes them and wraps them in an explicit
// <lead_input> block. Pure, side-effect-free, no tools (least privilege).
// Implements ITEA-2787 controls 1 (isolation) and 2 (neutralization).

export const FIELD_LIMITS = {
  open: 1200, // open free-text answers
  short: 120, // single-token answers (sector, tamano, level...)
  email: 254,
};

// Injection markers — used only to ANNOTATE for audit/human sampling. The real
// defense is delimiting + neutralization below, not pattern matching.
const INJECTION_PATTERNS = [
  { re: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i, reason: "instruction_override" },
  { re: /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i, reason: "instruction_override" },
  { re: /forget\s+(all\s+)?(previous|prior|above|everything)/i, reason: "instruction_override" },
  { re: /olvida\s+(todas?\s+)?(las\s+)?(instrucciones|reglas)\s+(anteriores|previas)/i, reason: "instruction_override" },
  { re: /ignora\s+(todas?\s+)?(las\s+)?(instrucciones|reglas)\s+(anteriores|previas)/i, reason: "instruction_override" },
  { re: /you\s+are\s+now\b/i, reason: "persona_override" },
  { re: /act\s+as\s+(?:an?\s+)?(?:dan|jailbreak|admin|root|developer\s+mode)/i, reason: "persona_override" },
  { re: /(system|developer)\s*prompt/i, reason: "system_prompt_probe" },
  { re: /reveal\s+(?:your|the)\s+(?:system\s+)?prompt/i, reason: "system_prompt_probe" },
  { re: /(muestra|revela|repite)\s+(tu|el)\s+(system\s+)?prompt/i, reason: "system_prompt_probe" },
  { re: /<\s*\/?\s*(?:system|assistant|user|lead_input)\s*>/i, reason: "fake_role_tag" },
  { re: /<\|\s*im_(start|end)\s*\|>/i, reason: "fake_chat_template" },
  { re: /\[\s*\/?\s*INST\s*\]/i, reason: "fake_chat_template" },
  { re: /\bBEGIN\s+SYSTEM\s+PROMPT\b/i, reason: "fake_chat_template" },
];

// Strip C0/C1 control chars (keep \n, \t), zero-width and bidi-override chars
// that can hide payloads or visually reorder text.
function stripControl(s) {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "");
}

// Neutralize any markup that could imitate our system delimiters. Lead answers
// are plain prose; replacing angle brackets with look-alike guillemets keeps
// what the visitor typed legible while making tag breakout impossible.
function neutralizeMarkup(s) {
  return s.replace(/</g, "‹").replace(/>/g, "›");
}

function collapseWhitespace(s) {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function detectInjection(raw) {
  const flags = [];
  for (const { re, reason } of INJECTION_PATTERNS) {
    if (re.test(raw)) flags.push(reason);
  }
  return [...new Set(flags)];
}

export function sanitizeField(value, maxLen = FIELD_LIMITS.open) {
  const raw = value == null ? "" : String(value);
  const flags = detectInjection(raw);
  let clean = stripControl(raw.normalize("NFC"));
  clean = neutralizeMarkup(clean);
  clean = collapseWhitespace(clean);
  let truncated = false;
  if (clean.length > maxLen) {
    clean = clean.slice(0, maxLen).trimEnd() + "…";
    truncated = true;
  }
  return { clean, flags, truncated };
}

// Canonical open-text question labels (kept human-readable for the draft).
const OPEN_FIELDS = {
  open_repetitivo: "Tarea repetitiva que más tiempo le quita",
  open_freno: "Lo que le frena para adoptar IA",
  open_objetivo: "Resultado tangible que querría en 90 días",
};

const SHORT_FIELDS = {
  sector: "Sector",
  tamano: "Tamaño",
};

// Build the audited, isolated representation of one lead. Returns the cleaned
// per-field values, the <lead_input> block string, and aggregated audit flags.
export function sanitizeLead(record) {
  const answers = record && typeof record.answers === "object" && record.answers ? record.answers : {};
  const out = { openFields: {}, shortFields: {}, flags: [], truncatedFields: [] };

  for (const [key, label] of Object.entries(SHORT_FIELDS)) {
    const r = sanitizeField(answers[key], FIELD_LIMITS.short);
    out.shortFields[key] = { label, value: r.clean };
    out.flags.push(...r.flags);
    if (r.truncated) out.truncatedFields.push(key);
  }
  for (const [key, label] of Object.entries(OPEN_FIELDS)) {
    const r = sanitizeField(answers[key], FIELD_LIMITS.open);
    out.openFields[key] = { label, value: r.clean };
    out.flags.push(...r.flags);
    if (r.truncated) out.truncatedFields.push(key);
  }

  const level = sanitizeField(record?.level, FIELD_LIMITS.short).clean;
  const score = record?.score && typeof record.score === "object" ? record.score : null;
  const overall = score && Number.isFinite(Number(score.overall)) ? Number(score.overall) : null;

  out.flags = [...new Set(out.flags)];
  out.level = level;
  out.scoreOverall = overall;
  out.leadInputBlock = buildLeadInputBlock(out);
  return out;
}

function buildLeadInputBlock({ shortFields, openFields, level, scoreOverall }) {
  const lines = ["<lead_input>"];
  if (level) lines.push(`Nivel de madurez: ${level}`);
  if (scoreOverall != null) lines.push(`Puntuación global: ${scoreOverall}/100`);
  for (const { label, value } of Object.values(shortFields)) {
    if (value) lines.push(`${label}: ${value}`);
  }
  for (const { label, value } of Object.values(openFields)) {
    lines.push(`${label}: ${value || "(sin respuesta)"}`);
  }
  lines.push("</lead_input>");
  return lines.join("\n");
}
