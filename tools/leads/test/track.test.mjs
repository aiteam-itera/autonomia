import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeSendEntry, recordSend, loadSends, computeReplyRate, SEND_STATUS } from "../lib/track.mjs";

test("makeSendEntry requires a ref and defaults status to drafted", () => {
  assert.throws(() => makeSendEntry({ email: "a@b.c" }), /missing_ref/);
  const e = makeSendEntry({ ref: "r1", email: "a@b.c" });
  assert.equal(e.status, SEND_STATUS.DRAFTED);
  assert.equal(e.leadKey, "r1");
});

test("recordSend appends and loadSends round-trips", () => {
  const dir = mkdtempSync(join(tmpdir(), "track-"));
  const path = join(dir, "sub/sends.jsonl");
  recordSend(path, { ref: "r1", email: "a@b.c", status: SEND_STATUS.SENT });
  recordSend(path, { ref: "r2", email: "d@e.f", status: SEND_STATUS.SENT });
  const rows = loadSends(path);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].ref, "r1");
  assert.match(readFileSync(path, "utf8"), /\n$/);
});

test("loadSends on a missing file is empty", () => {
  assert.deepEqual(loadSends(join(tmpdir(), "nope-xyz.jsonl")), []);
});

test("computeReplyRate counts only sent refs and intersects replies", () => {
  const sends = [
    { ref: "a", status: "sent" },
    { ref: "b", status: "sent" },
    { ref: "c", status: "drafted" }, // not sent → excluded
  ];
  const m = computeReplyRate(sends, ["a", "z"]); // z never sent → ignored
  assert.equal(m.sent, 2);
  assert.equal(m.replied, 1);
  assert.equal(m.rate, 0.5);
  assert.deepEqual(m.repliedRefs, ["a"]);
});

test("computeReplyRate: latest event per ref wins (failed then sent = sent)", () => {
  const sends = [
    { ref: "a", status: "failed" },
    { ref: "a", status: "sent" },
  ];
  const m = computeReplyRate(sends, ["a"]);
  assert.equal(m.sent, 1);
  assert.equal(m.replied, 1);
});

test("computeReplyRate with no sends is a clean zero (no divide-by-zero)", () => {
  const m = computeReplyRate([], ["a"]);
  assert.equal(m.sent, 0);
  assert.equal(m.rate, 0);
});
