import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSubmission } from "../src/contact-handlers.ts";

const valid = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Quiero automatizar la respuesta a tickets de soporte.",
  sector: "servicios",
};

test("accepts a well-formed submission", () => {
  const r = parseSubmission(valid);
  assert.ok(r);
  assert.equal(r!.name, "Ada Lovelace");
  assert.equal(r!.email, "ada@example.com");
  assert.equal(r!.sector, "servicios");
  assert.equal(r!.website, "");
});

test("rejects missing email", () => {
  const r = parseSubmission({ ...valid, email: "" });
  assert.equal(r, null);
});

test("rejects malformed email", () => {
  const r = parseSubmission({ ...valid, email: "not-an-email" });
  assert.equal(r, null);
});

test("rejects empty message", () => {
  const r = parseSubmission({ ...valid, message: "   " });
  assert.equal(r, null);
});

test("rejects message over 2000 chars", () => {
  const r = parseSubmission({ ...valid, message: "a".repeat(2001) });
  assert.equal(r, null);
});

test("trims whitespace and accepts when sector missing", () => {
  const r = parseSubmission({ ...valid, sector: "  ", name: "   Ada    " });
  assert.ok(r);
  assert.equal(r!.name, "Ada");
  assert.equal(r!.sector, undefined);
});

test("preserves honeypot value so the handler can short-circuit", () => {
  const r = parseSubmission({ ...valid, website: "https://spammer.example/" });
  assert.ok(r);
  assert.equal(r!.website, "https://spammer.example/");
});

test("rejects non-object body", () => {
  assert.equal(parseSubmission(null), null);
  assert.equal(parseSubmission("string"), null);
  assert.equal(parseSubmission(42), null);
});
