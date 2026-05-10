import type { Rule } from "../types.ts";
import { promptInjectionRule } from "./prompt-injection.ts";
import { destructiveRule } from "./destructive.ts";
import { piiRule } from "./pii.ts";
import { spamRule } from "./spam.ts";
import { languageRule } from "./language.ts";

// Order matters: harder/cheaper checks first.
export const RULES: readonly Rule[] = [
  promptInjectionRule,
  destructiveRule,
  piiRule,
  spamRule,
  languageRule,
] as const;

// Bump every time the rule list or any individual pattern changes.
// Logs reference this so we can correlate a moderation decision with the exact
// ruleset that produced it.
export const RULESET_VERSION = "2026-05-10.1";
