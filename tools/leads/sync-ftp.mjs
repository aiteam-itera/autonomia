#!/usr/bin/env node
// IONOS SFTP pull of the append-only lead store (`_leads/leads.jsonl`) to a
// local, ephemeral path so `ingest.mjs` can read the delta. Invoked ONCE per
// routine firing, before ingest — never a busy-loop.
//
// The lead store lives OUTSIDE the public docroot (`_submit.php` appends to
// `__DIR__/../_leads/leads.jsonl`), so it is fetched over SFTP, never HTTP.
// We reuse the same credentials the deploy workflow uses (lftp over SFTP), so
// there is no second tool or secret to maintain.
//
// Usage:
//   node sync-ftp.mjs [--out <path>] [--remote <path>] [--dry-run]
//
// Credentials come from the environment (provided by the routine / CI secrets):
//   IONOS_SFTP_HOST       (required)        e.g. access-XXXX.webspace-data.io
//   IONOS_SFTP_PORT       (default 22)
//   IONOS_SFTP_USER       (required)
//   IONOS_SFTP_PASSWORD   (required)
//   LEADS_REMOTE_PATH     remote path to leads.jsonl
//                         (default: ../_leads/leads.jsonl relative to the
//                          SFTP login dir, which on IONOS is the docroot)
//   LEADS_LOCAL_PATH      local destination (default: ./_leads/leads.jsonl,
//                         gitignored — never committed; contains PII)
//
// Exit codes: 0 = synced (or no leads yet → empty local file written),
//             non-zero only on a real auth/transport error.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  const a = {
    out: process.env.LEADS_LOCAL_PATH || "./_leads/leads.jsonl",
    remote: process.env.LEADS_REMOTE_PATH || "../_leads/leads.jsonl",
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--out") a.out = argv[++i];
    else if (k === "--remote") a.remote = argv[++i];
    else if (k === "--dry-run") a.dryRun = true;
  }
  return a;
}

// Build the lftp command script. Credentials are passed on lftp's stdin (NOT in
// argv) so they never appear in the process list. `redact` swaps the password
// for **** so the same script can be printed safely in --dry-run / logs.
export function buildLftpScript(
  { host, port, user, password, remote, out },
  { redact = false } = {}
) {
  const pass = redact ? "****" : password;
  return [
    "set sftp:auto-confirm yes",
    "set net:max-retries 3",
    "set net:reconnect-interval-base 5",
    `open -u "${user}","${pass}" "sftp://${host}:${port}"`,
    // -O writes into a directory; the basename is preserved.
    `get -O "${dirname(out)}" "${remote}"`,
    "bye",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outPath = resolve(args.out);
  const outDir = dirname(outPath);
  mkdirSync(outDir, { recursive: true });

  const env = {
    host: process.env.IONOS_SFTP_HOST,
    port: process.env.IONOS_SFTP_PORT || "22",
    user: process.env.IONOS_SFTP_USER,
    password: process.env.IONOS_SFTP_PASSWORD,
    remote: args.remote,
    out: outPath,
  };

  if (args.dryRun) {
    // Show what WOULD run, with the password redacted and missing creds flagged.
    const missing = ["host", "user", "password"].filter((k) => !env[k]);
    process.stdout.write(
      `[sync-ftp] DRY RUN — would pull ${env.remote} → ${outPath}\n` +
        (missing.length ? `[sync-ftp] MISSING env: ${missing.join(", ")}\n` : "") +
        `--- lftp script ---\n${buildLftpScript(env, { redact: true })}\n`
    );
    return;
  }

  for (const k of ["host", "user", "password"]) {
    if (!env[k]) {
      process.stderr.write(`[sync-ftp] missing required env IONOS_SFTP_${k.toUpperCase()}\n`);
      process.exit(2);
    }
  }

  const probe = spawnSync("lftp", ["--version"], { encoding: "utf8" });
  if (probe.error) {
    process.stderr.write(
      "[sync-ftp] lftp not found. Install it (apt-get install -y lftp) — same tool the deploy workflow uses.\n"
    );
    process.exit(3);
  }

  const script = buildLftpScript(env);
  const run = spawnSync("lftp", [], { input: script, encoding: "utf8" });

  if (run.status === 0 && existsSync(outPath)) {
    const bytes = statSync(outPath).size;
    process.stdout.write(`[sync-ftp] synced ${env.remote} → ${outPath} (${bytes} bytes)\n`);
    return;
  }

  // lftp returns non-zero when the remote file does not exist yet (no leads
  // captured so far). That is a normal no-op, not a failure: write an empty
  // store so ingest.mjs runs cleanly and processes zero new leads.
  const stderr = (run.stderr || "").toLowerCase();
  const noFile =
    stderr.includes("no such file") ||
    stderr.includes("access failed") ||
    stderr.includes("not found");
  if (noFile && !existsSync(outPath)) {
    writeFileSync(outPath, "");
    process.stdout.write(`[sync-ftp] no remote leads file yet → wrote empty ${outPath}\n`);
    return;
  }

  process.stderr.write(
    `[sync-ftp] FAILED (status=${run.status}). stderr:\n${run.stderr || "(none)"}\n`
  );
  process.exit(run.status || 1);
}

// Only run when executed directly (so the unit test can import buildLftpScript).
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
