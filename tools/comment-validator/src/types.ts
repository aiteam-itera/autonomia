export type Severity = "safe" | "soft" | "hard";

export interface CommentInput {
  name: string;
  email: string;
  comment: string;
}

export interface ValidationResult {
  accepted: boolean;
  severity: Severity;
  reason?: string;
  ruleId?: string;
  rulesetVersion: string;
}

export interface RuleHit {
  severity: Exclude<Severity, "safe">;
  reason: string;
}

export interface Rule {
  id: string;
  describe: string;
  check(input: CommentInput): RuleHit | null;
}
