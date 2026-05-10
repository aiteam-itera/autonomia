# tests/

Playwright end-to-end tests for the static site (`site/`).

## Run

```bash
cd tests
npm install
npx playwright install --with-deps chromium
npm test
```

The `playwright.config.js` boots `python3 -m http.server -d ../site 4173` so
the tests hit the same files that get deployed to IONOS.

## Tests

- `contact.spec.js` — `#contacto` form on the home page.
  - Golden path: real submit → Worker called with expected fields → success hint.
  - Honeypot: hidden `website` field round-trips to the Worker so the server can decide.
  - Honeypot is visually hidden from real users.

The Worker endpoint (`POST /api/contact`) is mocked with `page.route()`, so
these tests never hit the real Cloudflare deployment. Server-side honeypot
rejection and rate-limiting are covered by the Worker's own tests
(`worker/`).
