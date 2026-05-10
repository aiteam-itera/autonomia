import type { Rule } from "../types.ts";

// CJK / Cyrillic / Arabic / Hebrew block ranges. Presence of any character in
// these blocks → assume the comment is not in es/en and soft-reject.
// We do NOT try to detect language properly; we just bail when the script is
// outside the Latin alphabet, which is a safe heuristic for our audience.
const NON_LATIN_RE = /[Ѐ-ӿ֐-׿؀-ۿ぀-ヿ㐀-䶿一-鿿가-힯]/;

export const languageRule: Rule = {
  id: "language",
  describe: "Soft-rejects comments outside the Latin script (es/en supported only).",
  check(input) {
    if (NON_LATIN_RE.test(input.comment)) {
      return { severity: "soft", reason: "non_latin_script" };
    }
    return null;
  },
};
