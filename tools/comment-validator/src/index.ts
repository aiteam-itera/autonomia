import type { CommentInput, ValidationResult } from "./types.ts";
import { RULES, RULESET_VERSION } from "./rules/index.ts";

export type { CommentInput, ValidationResult, Severity, Rule, RuleHit } from "./types.ts";
export { RULES, RULESET_VERSION } from "./rules/index.ts";

const MIN_COMMENT_LEN = 10;
const MAX_COMMENT_LEN = 1500;
const MAX_NAME_LEN = 80;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validate(raw: CommentInput): ValidationResult {
  const name = (raw.name ?? "").trim();
  const email = (raw.email ?? "").trim().toLowerCase();
  const comment = (raw.comment ?? "").trim();

  // Shape checks first — anything that isn't a well-formed input is a hard reject.
  if (!name) return hard("missing_name", "shape");
  if (name.length > MAX_NAME_LEN) return hard("name_too_long", "shape");
  if (!EMAIL_RE.test(email)) return hard("invalid_email", "shape");
  if (comment.length < MIN_COMMENT_LEN) return hard("too_short", "shape");
  if (comment.length > MAX_COMMENT_LEN) return hard("too_long", "shape");

  const input: CommentInput = { name, email, comment };

  // Run rules in order. Hard hit stops the chain immediately; soft hits are
  // remembered so the caller knows to send it to human moderation rather than
  // straight to the agent loop.
  let firstSoft: { reason: string; ruleId: string } | null = null;
  for (const rule of RULES) {
    const hit = rule.check(input);
    if (!hit) continue;
    if (hit.severity === "hard") {
      return {
        accepted: false,
        severity: "hard",
        reason: hit.reason,
        ruleId: rule.id,
        rulesetVersion: RULESET_VERSION,
      };
    }
    if (hit.severity === "soft" && !firstSoft) {
      firstSoft = { reason: hit.reason, ruleId: rule.id };
    }
  }

  if (firstSoft) {
    return {
      accepted: false,
      severity: "soft",
      reason: firstSoft.reason,
      ruleId: firstSoft.ruleId,
      rulesetVersion: RULESET_VERSION,
    };
  }

  return {
    accepted: true,
    severity: "safe",
    rulesetVersion: RULESET_VERSION,
  };
}

function hard(reason: string, ruleId: string): ValidationResult {
  return {
    accepted: false,
    severity: "hard",
    reason,
    ruleId,
    rulesetVersion: RULESET_VERSION,
  };
}
