import type { Rule } from "../types.ts";

const MAX_LINKS = 3;

// Lower-cased TLDs / domain fragments that are almost always spam in our context.
// Keep this list small and surgical; over-broad blocks are worse than no block.
const BLACKLIST = [
  "bit.ly",
  "tinyurl.com",
  "goo.gl",
  "is.gd",
  "buff.ly",
  ".ru/",
  ".xyz/",
  "casino",
  "viagra",
  "cialis",
  "porn",
  "xxx",
  "adult-",
  "crypto-pump",
];

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;
const BARE_DOMAIN_RE =
  /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|ai|es|co|info|biz|ru|xyz|cn)\b/gi;

export const spamRule: Rule = {
  id: "spam_seo",
  describe: "Blocks comments with too many links or links to known spam/SEO domains.",
  check(input) {
    const text = input.comment.toLowerCase();
    const lower = text;

    for (const needle of BLACKLIST) {
      if (lower.includes(needle)) {
        return { severity: "hard", reason: `blacklist:${needle}` };
      }
    }

    const urls = input.comment.match(URL_RE) ?? [];
    const bareDomains = input.comment.match(BARE_DOMAIN_RE) ?? [];
    const linkCount = urls.length + Math.max(0, bareDomains.length - urls.length);

    if (linkCount > MAX_LINKS) {
      return { severity: "soft", reason: `too_many_links:${linkCount}` };
    }
    return null;
  },
};
