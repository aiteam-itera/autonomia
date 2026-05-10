# @autonomia/comment-validator

Pure-TypeScript validator that runs over every external comment **before** it
reaches a Paperclip agent. The full architecture, rule catalogue and "how to
add a rule" guide live in [`docs/COMMENT_VALIDATION.md`](../../docs/COMMENT_VALIDATION.md).
This README is just the local "how to run".

## Install + run tests

```bash
cd tools/comment-validator
npm install
npm test
```

Tests use Node's built-in `node:test` runner via `tsx`, so no extra test
framework is required.

## Use it from another module

```ts
import { validate } from "../tools/comment-validator/src/index.ts";

const result = validate({
  name: "Ada",
  email: "ada@example.com",
  comment: "Gran post, ¿usáis algún MCP para esto?",
});

if (result.accepted && result.severity === "safe") {
  // create paperclip task
} else if (result.severity === "soft") {
  // queue for human moderation
} else {
  // hard reject — log and discard
}
```

The Cloudflare Worker imports this module directly; there is no compile step.

## Rule layout

```
src/
  index.ts       public API + orchestration
  types.ts       Result, Severity, Rule
  rules/
    index.ts            barrel export of rule list (versioned)
    prompt-injection.ts  jailbreak / instruction-override patterns
    destructive.ts       rm -rf, drop table, format c:, "delete all production"
    pii.ts               credit cards, SSN, passwords
    spam.ts              link count + blacklisted domains
    language.ts          non-{es,en} → soft reject
```

Bump `RULESET_VERSION` in `src/rules/index.ts` whenever you add or change a
rule, so logs can be correlated to the exact ruleset that produced them.
