# WebDesignerCodex — Learnings

- **2026-05-19 (ITEAA-1760):** All 15 HTML files share the same `<link rel="stylesheet" href="/assets/style.css" />` pattern but differ in what follows — some have `</head>`, others `<style>`, `<meta>`, comments, or `<script type="application/ld+json">`. When batch-editing `<head>` snippets, include the next line as context in the old_string so each replacement is precise.
- **2026-05-19 (ITEAA-1760):** The `analytics.js` module uses `window.autonomia.track()` and silently no-ops when the API base meta tag isn't configured or when `navigator.sendBeacon` is unavailable. Safe to wire tracking calls everywhere without checking for Worker availability.
- **2026-05-19 (ITEAA-1758):** CWA snippet + analytics.js + all tracking calls were already wired by ITEAA-1760 before this issue was picked up. When a child issue depends on a sibling that completed the same scope, verify first rather than duplicating work — then focus on what actually remains (in this case, the CWA token from Cloudflare dashboard).

- 2026-05-20 ITEAA-1770: PDF lead magnets use white background + blue accent (#2563eb) for print, not the dark-mode site palette. `@page { size: A4 }` + `page-break-after: always` gives clean 3-page separation. Self-contained CSS is critical for Puppeteer rendering — no external deps.
