# ITEA-3293 Home Hero Narrative

## Requirement
AutonomIA home needed a stronger first screen and narrative arc: one clear promise,
the CTA "Diagnostico en 5 min", visible before-method-after storytelling, early
proof, and reuse of the shared design system instead of inline page styling.

## Decision
The home was rewritten around a single buyer decision: identify the first pyme
process worth automating. The hero now leads with that outcome, a diagnostic
preview panel, and one primary CTA. The old proof cards were moved after a new
transformation arc so the reader first understands the pain, then sees the method
and concrete example reports. Shared components from the v2 design system
(`card`, `steps`, `arc`, `badge`, `trust-row`, `cta`) were preferred; only a
delimited `Home page (ITEA-3293)` CSS block was added for page-specific layout.

## Changed Surfaces
- **Files**: `site/index.html`, `site/assets/style.css`
- **Runtime**: static home page at `https://ia.itera.es/`
- **Docs**: this change-memory note

## Follow-ups
Fable still needs to review the deployed page against the broader web rework
direction before closing the ticket. The local Codex workspace could not run
Playwright because the Chromium binary was missing and the browser installer
stalled; GitHub Actions validation supplied the deployed browser screenshot
artifact instead.
