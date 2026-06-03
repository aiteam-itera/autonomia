#!/usr/bin/env node
// Baseline KPI report for the AutonomIA first-party analytics log.
//
// The log is collected by site/_a.php and stored OUTSIDE the public docroot at
// IONOS chroot path /_analytics/a.log. Pull it locally, then run:
//
//   curl -s -k --user "acc736162435:$ionosftpaccess" \
//     "sftp://access878577274.webspace-data.io:22/_analytics/a.log" > a.log
//   node tools/analytics-baseline.mjs a.log
//
// Log line format (TSV): isoTs \t visitorHash \t event \t path \t refHost \t utmSource
// (utmSource column added 2026-06-03; older lines have 5 columns — handled gracefully.)
// Privacy note: visitorHash rotates daily, so "unique visitors" is the sum of
// per-day uniques (a privacy-preserving under/over-count tradeoff, same as
// Plausible's daily-salt model). It is a stable baseline, not a CRM identity.

import { readFileSync } from "node:fs";

const file = process.argv[2] || "a.log";
const lines = readFileSync(file, "utf8").split("\n").filter(Boolean);

const events = {};
const dailyVisitors = {}; // day -> Set(visitorHash)
const utmCounts = {}; // utm_source -> { page_view, quiz_start, quiz_finish, contact_form_submit }
let pageViewsHome = 0;
let pageViewsTotal = 0;

for (const line of lines) {
  const [ts, visitor, event, path, _refHost, utmSource] = line.split("\t");
  if (!event) continue;
  events[event] = (events[event] || 0) + 1;
  const day = (ts || "").slice(0, 10);
  (dailyVisitors[day] ||= new Set()).add(visitor);
  if (event === "page_view") {
    pageViewsTotal++;
    if (path === "/" || path === "/index.html") pageViewsHome++;
  }
  if (utmSource) {
    const u = (utmCounts[utmSource] ||= { page_view: 0, quiz_start: 0, quiz_finish: 0, contact_form_submit: 0 });
    if (u[event] !== undefined) u[event]++;
  }
}

const uniqueVisitors = Object.values(dailyVisitors).reduce((a, s) => a + s.size, 0);
const days = Object.keys(dailyVisitors).filter(Boolean).sort();
const n = (e) => events[e] || 0;
const pct = (num, den) => (den > 0 ? ((num / den) * 100).toFixed(1) + "%" : "n/a");

console.log("=== AutonomIA funnel baseline ===");
console.log(`Window:            ${days[0] || "-"} → ${days[days.length - 1] || "-"} (${days.length} day(s))`);
console.log(`Unique visitors:   ${uniqueVisitors} (sum of per-day uniques)`);
console.log(`Page views:        ${pageViewsTotal} total, ${pageViewsHome} on home`);
console.log("");
console.log("Funnel KPIs:");
console.log(`  Hero CTA click rate:   ${pct(n("hero_cta_click"), pageViewsHome)}  (hero_cta_click / home page_view)`);
console.log(`  Quiz start rate:       ${pct(n("quiz_start"), pageViewsTotal)}  (quiz_start / page_view)`);
console.log(`  Quiz completion rate:  ${pct(n("quiz_finish"), n("quiz_start"))}  (quiz_finish / quiz_start)`);
console.log(`  Assessment completion: ${pct(n("assessment_complete"), n("assessment_start"))}  (assessment_complete / assessment_start)`);
console.log(`  Contact submit rate:   ${pct(n("contact_form_submit"), pageViewsTotal)}  (contact_form_submit / page_view)`);
console.log("");
console.log("All event counts:");
for (const [e, c] of Object.entries(events).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${e.padEnd(24)} ${c}`);
}

const utmEntries = Object.entries(utmCounts);
if (utmEntries.length > 0) {
  console.log("");
  console.log("UTM source breakdown (which distribution channels delivered):");
  console.log(`  ${"source".padEnd(20)} ${"views".padStart(6)} ${"quiz_st".padStart(8)} ${"quiz_fi".padStart(8)} ${"contact".padStart(8)}`);
  for (const [src, u] of utmEntries.sort((a, b) => b[1].page_view - a[1].page_view)) {
    console.log(`  ${src.padEnd(20)} ${String(u.page_view).padStart(6)} ${String(u.quiz_start).padStart(8)} ${String(u.quiz_finish).padStart(8)} ${String(u.contact_form_submit).padStart(8)}`);
  }
}
