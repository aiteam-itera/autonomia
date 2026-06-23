import test from "node:test";
import assert from "node:assert/strict";
import { buildLftpScript } from "../sync-ftp.mjs";

const base = {
  host: "access-1234.webspace-data.io",
  port: "22",
  user: "u99999",
  password: "s3cr3t!pa$$",
  remote: "../_leads/leads.jsonl",
  out: "/tmp/leads-sync/_leads/leads.jsonl",
};

test("script opens the SFTP host and gets the remote leads file into the out dir", () => {
  const s = buildLftpScript(base);
  assert.match(s, /open -u "u99999","s3cr3t!pa\$\$" "sftp:\/\/access-1234\.webspace-data\.io:22"/);
  assert.match(s, /get -O "\/tmp\/leads-sync\/_leads" "\.\.\/_leads\/leads\.jsonl"/);
  assert.match(s, /^set sftp:auto-confirm yes/m);
  assert.match(s, /^bye$/m);
});

test("redact mode hides the password but keeps the user and host", () => {
  const s = buildLftpScript(base, { redact: true });
  assert.ok(!s.includes("s3cr3t!pa$$"), "real password must not appear in redacted script");
  assert.match(s, /open -u "u99999","\*\*\*\*"/);
  assert.match(s, /access-1234\.webspace-data\.io/);
});
