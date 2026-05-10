import type { Rule } from "../types.ts";

const PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i, reason: "instruction_override" },
  { re: /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i, reason: "instruction_override" },
  { re: /forget\s+(all\s+)?(previous|prior|above|everything)/i, reason: "instruction_override" },
  { re: /you\s+are\s+now\b/i, reason: "persona_override" },
  { re: /act\s+as\s+(?:an?\s+)?(?:dan|jailbreak|admin|root|developer\s+mode)/i, reason: "persona_override" },
  { re: /system\s*prompt/i, reason: "system_prompt_probe" },
  { re: /reveal\s+(?:your|the)\s+(?:system\s+)?prompt/i, reason: "system_prompt_probe" },
  { re: /<\s*\/?\s*(?:system|assistant|user)\s*>/i, reason: "fake_role_tag" },
  { re: /<\|\s*im_start\s*\|>/i, reason: "fake_chat_template" },
  { re: /<\|\s*im_end\s*\|>/i, reason: "fake_chat_template" },
  { re: /\[\s*INST\s*\]/i, reason: "fake_chat_template" },
  { re: /\bBEGIN\s+SYSTEM\s+PROMPT\b/i, reason: "fake_chat_template" },
  { re: /<\s*script\b/i, reason: "html_script_tag" },
  { re: /javascript:\s*[^\s]/i, reason: "js_uri" },
  { re: /data:text\/html/i, reason: "data_html_uri" },
];

export const promptInjectionRule: Rule = {
  id: "prompt_injection",
  describe: "Detects common prompt-injection / jailbreak patterns and HTML/JS payloads.",
  check(input) {
    const text = input.comment;
    for (const { re, reason } of PATTERNS) {
      if (re.test(text)) return { severity: "hard", reason };
    }
    return null;
  },
};
