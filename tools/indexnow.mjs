#!/usr/bin/env node
// Push all sitemap URLs to IndexNow (Bing, Yandex, DuckDuckGo, ChatGPT search, etc.).
// IndexNow needs no account — just a key file hosted at the docroot root.
//
// Key file: site/1842ee5ca6e204cd3eef5633f8e18ea8.txt (deployed to https://ia.itera.es/<key>.txt)
//
// Usage:  node tools/indexnow.mjs            (submits every <loc> in site/sitemap.xml)
//         node tools/indexnow.mjs <url> ...  (submits only the given URLs)
//
// Run AFTER a deploy so the key file and new pages are live, otherwise IndexNow
// will reject the batch on key verification.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HOST = "ia.itera.es";
const KEY = "1842ee5ca6e204cd3eef5633f8e18ea8";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function urlsFromSitemap() {
  const xml = readFileSync(join(root, "site", "sitemap.xml"), "utf8");
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

const urlList = process.argv.slice(2).length ? process.argv.slice(2) : urlsFromSitemap();
if (!urlList.length) {
  console.error("No URLs to submit.");
  process.exit(1);
}

const body = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

const text = await res.text();
console.log(`IndexNow → ${res.status} ${res.statusText}`);
console.log(`Submitted ${urlList.length} URL(s):`);
for (const u of urlList) console.log(`  ${u}`);
if (text) console.log(`Response body: ${text}`);

// IndexNow returns 200 (accepted) or 202 (accepted, pending). Anything else is a failure.
if (res.status !== 200 && res.status !== 202) process.exit(1);
