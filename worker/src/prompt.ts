// DEPRECATED (ITEA-3110, 2026-06-23): Worker lead-prompt builder. Superseded by
// `tools/leads/lib/prompt.mjs` (in-house path). Not wired to production.
// See docs/LEAD_RECOMMENDATION_PIPELINE.md.
import type { SubmitPayload } from "./types";
import { buildGuardedPrompt, type GuardedPrompt } from "./guardrail";

// Trusted, internal catalog and output-format blocks. These are NOT visitor
// data and are passed to the guardrail as the trusted portions of the prompt.
const CATALOG = `Catalogo de productos (usalo solo cuando encaje, maximo dos enlaces):
- Ficha.es — para empresas que necesitan estructurar procesos antes de automatizar.
  https://ficha.es
- Ironclip / BPAC — para empresas listas para implantar IA gobernada (orquestacion, auditoria).
  https://ironclip.com
- Itera.es — servicios de consultoria e implementacion a medida.
  https://itera.es`;

const OUTPUT_FORMAT = `Devuelve EXACTAMENTE este formato Markdown, sin texto adicional fuera:

## Tu plan AutonomIA · 30 / 60 / 90 dias

**En 30 dias — quick win**
[2-3 frases con la primera accion concreta, basada en la tarea repetitiva]

**En 60 dias — automatizacion guiada**
[2-3 frases]

**En 90 dias — gobernanza y metrica**
[2-3 frases que conecten con el objetivo a 90 dias]

**Recomendacion**
[1-2 productos del catalogo con su enlace, justificando por que encaja con esta empresa]`;

/**
 * Build the recommendation prompt with the visitor's open-text isolated inside
 * a delimited <lead_input> block and neutralized against prompt injection
 * (ITEA-2787). Returns the prompt plus per-field audit flags so the caller can
 * log them and trigger human sampling. Use `buildPrompt` if you only need the
 * string.
 */
export function buildGuardedSubmitPrompt(payload: SubmitPayload): GuardedPrompt {
  const { answers, score, level } = payload;
  const dimsLine = Object.entries(score.dims)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return buildGuardedPrompt({
    sector: answers.sector,
    tamano: answers.tamano,
    overall: score.overall,
    level,
    dimsLine,
    catalog: CATALOG,
    outputFormat: OUTPUT_FORMAT,
    openText: {
      open_repetitivo: answers.open_repetitivo,
      open_freno: answers.open_freno,
      open_objetivo: answers.open_objetivo,
    },
  });
}

export function buildPrompt(payload: SubmitPayload): string {
  return buildGuardedSubmitPrompt(payload).prompt;
}
