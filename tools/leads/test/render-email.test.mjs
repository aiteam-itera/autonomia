import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { draftToHtml, renderRecoEmail, messageId } from "../lib/render-email.mjs";
import { prepareReco } from "../prepare-send.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const draft = readFileSync(join(here, "../fixtures/sample-draft.md"), "utf8");
const lead = JSON.parse(readFileSync(join(here, "../fixtures/sample-lead.json"), "utf8"));

test("draftToHtml renders heading, section headers, paragraphs", () => {
  const html = draftToHtml(draft);
  assert.match(html, /<h1[^>]*>Tu plan AutonomIA/);
  assert.match(html, /<h3[^>]*>En 30 días/);
  assert.match(html, /<p[^>]*>.*copiamos a mano las facturas/s);
});

test("draftToHtml linkifies bare URLs in parentheses", () => {
  const html = draftToHtml(draft);
  assert.match(html, /<a href="https:\/\/ficha\.es"[^>]*>https:\/\/ficha\.es<\/a>/);
  assert.match(html, /<a href="https:\/\/ironclip\.com"/);
});

test("draftToHtml escapes HTML before adding markup (no injection)", () => {
  const html = draftToHtml("## Tu plan AutonomIA\n\n<script>alert(1)</script> **x**");
  assert.ok(!html.includes("<script>"), "raw script tag must be escaped");
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<strong>x<\/strong>/);
});

test("draftToHtml linkifies markdown links but rejects non-http schemes", () => {
  const html = draftToHtml("## Tu plan AutonomIA\n\nMira [aquí](https://itera.es) y [no](javascript:evil)");
  assert.match(html, /<a href="https:\/\/itera\.es"[^>]*>aquí<\/a>/);
  assert.ok(!html.includes("javascript:evil") || !/<a[^>]*javascript:/.test(html));
});

test("messageId carries the ref for reply correlation", () => {
  assert.equal(messageId("abc123"), "<reco-abc123@itera.es>");
});

test("renderRecoEmail builds branded message with Reply-To and tracking header", () => {
  const msg = renderRecoEmail({ draft, lead, ref: "deadbeef" });
  assert.equal(msg.to, "lead-demo@example.com");
  assert.match(msg.subject, /recomendación personalizada/i);
  assert.equal(msg.headers["Reply-To"], "hola@itera.es");
  assert.equal(msg.headers["X-AutonomIA-Ref"], "deadbeef");
  assert.equal(msg.headers["Message-ID"], "<reco-deadbeef@itera.es>");
  assert.ok(!/^From:/m.test(Object.keys(msg.headers).join("\n")), "no custom From (IONOS rejects it)");
  assert.match(msg.html, /ia\.itera\.es/);
});

test("renderRecoEmail throws without ref or recipient", () => {
  assert.throws(() => renderRecoEmail({ draft, lead, ref: "" }), /missing_ref/);
  assert.throws(() => renderRecoEmail({ draft, lead: { email: "" }, ref: "x" }), /missing_recipient/);
});

test("prepareReco returns ready message for a valid draft and never marks SENT", () => {
  const r = prepareReco(lead, draft);
  assert.equal(r.ok, true);
  assert.equal(r.validation.ok, true);
  assert.ok(r.message.to);
  assert.equal(r.ledgerEntry.status, "drafted");
  assert.equal(r.ledgerEntry.ref, r.ref);
});

test("prepareReco rejects an invalid draft with no message", () => {
  const r = prepareReco(lead, "demasiado corto");
  assert.equal(r.ok, false);
  assert.equal(r.message, undefined);
  assert.ok(r.ledgerEntry.auditFlags.includes("too_short"));
});
