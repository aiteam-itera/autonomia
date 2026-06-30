# ITEA-3303 Lead Conversion Friction

## Requirement
AutonomIA needed contextual CTAs, lower-friction lead capture, and honest trust
signals around the conversion path. The change had to reuse the shared design
system and keep the first-party `_contact.php` collector aligned with the
front-end form.

## Decision
The final contact form was tightened instead of adding another page section:
name became optional, the CTA now promises the concrete response window, and the
form explains that there is no forced call or automatic newsletter. The existing
`?paquete=consulta#contacto` route now pre-fills the message like the paid
package CTAs. Empty-message leads are rejected server-side so the lower-friction
form still captures useful intent.

## Changed Surfaces
- **Files**: `site/index.html`, `site/assets/contact.js`, `site/_contact.php`, `site/assets/style.css`, `tests/contact.spec.js`
- **Runtime**: homepage contact form and same-origin lead collector
- **Docs**: this change-memory note

## Follow-ups
Browser tests require a Playwright Chromium binary in the execution image. PHP
syntax lint also requires PHP in the image; live PHP verification should remain
part of deployment closeout.
