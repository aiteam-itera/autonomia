#!/usr/bin/env node
// New-lead detector for the recommendation pipeline. Invoked ONCE per heartbeat
// / routine firing — never a busy-loop. Reads the append-only leads.jsonl,
// skips leads already processed (cursor file), and prints, for each new lead,
// the system+user prompt the IronBrain agent should answer plus its audit tag.
//
// Usage:
//   node ingest.mjs --leads <path> --state <path> [--mark] [--json]
//
// Defaults: --leads ../_leads/leads.jsonl (IONOS layout), --state .processed.json
// The leads file itself is synced from IONOS by the routine before this runs;
// this tool is storage-agnostic and only reads a local path.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildPrompt } from "./lib/prompt.mjs";

function parseArgs(argv) {
  const a = { leads: "../_leads/leads.jsonl", state: ".processed.json", mark: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--leads") a.leads = argv[++i];
    else if (k === "--state") a.state = argv[++i];
    else if (k === "--mark") a.mark = true;
    else if (k === "--json") a.json = true;
  }
  return a;
}

// Stable identity for a lead so re-runs never re-process the same record.
export function leadKey(record) {
  return createHash("sha256")
    .update(`${record.ts ?? ""}|${record.email ?? ""}`)
    .digest("hex")
    .slice(0, 16);
}

export function readLeads(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter((r) => r && typeof r === "object");
}

export function loadState(path) {
  if (!existsSync(path)) return { processed: [] };
  try {
    const s = JSON.parse(readFileSync(path, "utf8"));
    return { processed: Array.isArray(s.processed) ? s.processed : [] };
  } catch {
    return { processed: [] };
  }
}

export function findNewLeads(records, state) {
  const seen = new Set(state.processed);
  return records.filter((r) => !seen.has(leadKey(r)));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const records = readLeads(args.leads);
  const state = loadState(args.state);
  const fresh = findNewLeads(records, state);

  const items = fresh.map((record) => {
    const key = leadKey(record);
    const { system, user, audit } = buildPrompt(record);
    return { key, email: record.email, ts: record.ts, audit, system, user };
  });

  if (args.json) {
    process.stdout.write(JSON.stringify({ count: items.length, items }, null, 2) + "\n");
  } else {
    process.stdout.write(`# ${items.length} lead(s) nuevos\n\n`);
    for (const it of items) {
      process.stdout.write(`## Lead ${it.key} (${it.email})\n`);
      if (it.audit.flags.length) process.stdout.write(`> audit flags: ${it.audit.flags.join(", ")}\n`);
      process.stdout.write(`\n### SYSTEM\n${it.system}\n\n### USER\n${it.user}\n\n---\n\n`);
    }
  }

  if (args.mark && items.length) {
    const processed = [...new Set([...state.processed, ...items.map((i) => i.key)])];
    writeFileSync(args.state, JSON.stringify({ processed }, null, 2) + "\n");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
