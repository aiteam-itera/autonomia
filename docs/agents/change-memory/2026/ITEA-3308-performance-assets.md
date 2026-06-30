# ITEA-3308 Performance And Asset Loading

## Requirement
Improve home and servicios performance without redesigning the site or duplicating the shared design system. The work needed to reduce avoidable page-load cost, keep SEO/a11y intact, and remain deployable through the existing static `site/` to IONOS pipeline.

## Decision
The safest high-impact changes were network-level: remove the inert Cloudflare Web Analytics placeholder from the target pages, defer the home GitHub activity feed API requests until the feed is near the viewport, and add guarded Apache cache/compression rules through `site/.htaccess`. I did not minify or split the shared CSS because the stylesheet is intentionally the cross-page design system and manual minification would reduce maintainability without a build step.

## Changed Surfaces
- **Files**: `site/index.html`, `site/servicios.html`, `site/assets/agent-feed.js`, `site/.htaccess`
- **Runtime**: home initial load no longer calls Cloudflare or GitHub before the feed is viewed; Apache may compress/cache static assets when the hosting modules are available
- **Docs**: this change-memory note

## Follow-ups
If stronger cache durations are desired, first add hashed asset filenames or query-versioning in the static pages. The current `.htaccess` keeps CSS/JS at one day because filenames are stable and deploys overwrite them in place.
