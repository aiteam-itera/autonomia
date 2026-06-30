# ITEA-3310 Credibility Governance Layer

## Requirement
AutonomIA needed a credibility layer on the homepage: social proof, trustworthy
logos, and the existing Railway governance panel presented as a concrete trust
signal. The change had to reuse the shared design system and remain honest about
what proof is actually available.

## Decision
The existing `#gobernanza` section was expanded instead of adding a disconnected
marketing block. Client logos and invented testimonials were rejected because the
repo does not contain approved customer proof. The page now uses verifiable proof:
published sample reports, the Itera/Paperclip/Ironclip/Railway/GitHub Actions
stack, and a primary CTA to the live Railway governance panel. New CSS stays in
the existing homepage block and uses the current tokens, buttons, badges, cards,
and responsive rhythm.

## Changed Surfaces
- **Files**: `site/index.html`, `site/assets/style.css`
- **Runtime**: static homepage credibility/governance section at `https://ia.itera.es/#gobernanza`
- **Docs**: this change-memory note

## Follow-ups
Replace the reference quotes with named customer testimonials and approved client
logos only after the board supplies explicit permission and source text.
