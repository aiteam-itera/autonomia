# ITEA-3294 Servicios Pricing

## Requirement
`site/servicios.html` needed to sell the AutonomIA offer ladder more clearly:
diagnóstico, piloto and acompañamiento had to show sharper selling points,
comparison, price anchoring, value justification, guarantee, no lock-in, and
structured pricing data that matches the page.

## Decision
The page now frames price as risk reduction instead of a generic services list:
avoid the wrong pilot, get one process into production, or operate several live
flows with governance. A comparison section was added before the technical stack
so visitors can choose by current risk, not by reading every package card. The
commercial reassurance was made explicit with fixed scope, written budget, pilot
guarantee, diagnóstico discount and monthly no-lock-in. The existing dark design
system and scenarios table were reused; only the delimited services CSS block was
extended.

## Changed Surfaces
- **Files**: `site/servicios.html`, `site/assets/style.css`
- **Runtime**: static services and pricing page at `https://ia.itera.es/servicios.html`
- **Docs**: this change-memory note

## Follow-ups
`docs/project_state.yaml` does not exist in this repo, so no functionality tree
entry was updated. Fable still needs to review the deployed page before final
closure under the ITEA-3291 governance model.
