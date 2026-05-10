import type { Rule } from "../types.ts";

const HARD_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\brm\s+-rf\b/i, reason: "rm_rf" },
  { re: /\bformat\s+c:/i, reason: "format_disk" },
  { re: /\bdrop\s+table\b/i, reason: "drop_table" },
  { re: /\btruncate\s+table\b/i, reason: "truncate_table" },
  { re: /\bdelete\s+from\s+\w+\s*;?\s*$/im, reason: "raw_delete_from" },
  { re: /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/, reason: "fork_bomb" },
  { re: /\bmkfs\b/i, reason: "mkfs" },
  { re: /\bdd\s+if=.+of=\/dev\/(?:sd|nvme|disk)/i, reason: "dd_to_disk" },
  { re: /\b(?:shutdown|reboot)\s+-?[hr]\b/i, reason: "shutdown_command" },
];

const SOFT_QUESTIONS: RegExp[] = [
  /how\s+(?:do\s+I|can\s+I|to)\s+delete\s+(?:all\s+)?(?:production|prod|customer|user|all)\s+(?:data|users|records|accounts)/i,
  /c[oó]mo\s+(?:borr(?:o|ar)|elimin(?:o|ar))\s+(?:todos?\s+los?|toda\s+la)\s+(?:datos|usuarios|cuentas|registros)\s+(?:de\s+)?producci[óo]n/i,
  /how\s+(?:do\s+I|to)\s+(?:wipe|nuke|destroy)\s+(?:the\s+)?(?:database|db|server|production)/i,
  /how\s+(?:do\s+I|to)\s+access\s+(?:someone\s+else'?s|another\s+user'?s)\s+account/i,
];

export const destructiveRule: Rule = {
  id: "destructive_command",
  describe: "Blocks raw destructive shell/SQL payloads (hard) and 'how do I wipe prod' style questions (soft).",
  check(input) {
    const text = input.comment;
    for (const { re, reason } of HARD_PATTERNS) {
      if (re.test(text)) return { severity: "hard", reason };
    }
    for (const re of SOFT_QUESTIONS) {
      if (re.test(text)) return { severity: "soft", reason: "destructive_question" };
    }
    return null;
  },
};
