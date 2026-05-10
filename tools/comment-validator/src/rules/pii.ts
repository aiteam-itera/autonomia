import type { Rule } from "../types.ts";

// Loose credit-card heuristic: 13–19 digits, optionally separated by spaces or dashes.
// We don't run Luhn — false positives are fine, the action is "moderate", not "publish anyway".
const CREDIT_CARD_RE = /(?:\d[ -]?){13,19}/;

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/;
const SPANISH_DNI_RE = /\b\d{8}[A-HJ-NP-TV-Z]\b/;

const PASSWORD_LABEL_RE =
  /\b(?:password|contrase[ñn]a|passwd|pwd)\s*[:=]\s*\S{4,}/i;
const APIKEY_LABEL_RE =
  /\b(?:api[_-]?key|secret|token|bearer)\s*[:=]\s*[A-Za-z0-9_\-]{12,}/i;

export const piiRule: Rule = {
  id: "pii",
  describe: "Detects credit-card-like digit runs, SSN/DNI, and explicit password/api-key disclosures.",
  check(input) {
    const text = input.comment;

    if (CREDIT_CARD_RE.test(text)) {
      const digits = text.match(CREDIT_CARD_RE)![0]!.replace(/[^\d]/g, "");
      if (digits.length >= 13 && digits.length <= 19) {
        return { severity: "soft", reason: "looks_like_credit_card" };
      }
    }
    if (SSN_RE.test(text)) return { severity: "soft", reason: "looks_like_ssn" };
    if (SPANISH_DNI_RE.test(text)) return { severity: "soft", reason: "looks_like_dni" };
    if (PASSWORD_LABEL_RE.test(text)) return { severity: "hard", reason: "plaintext_password" };
    if (APIKEY_LABEL_RE.test(text)) return { severity: "hard", reason: "plaintext_api_key" };

    return null;
  },
};
