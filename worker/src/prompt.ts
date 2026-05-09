import type { SubmitPayload } from "./types";

export function buildPrompt(payload: SubmitPayload): string {
  const { answers, score, level } = payload;
  const dimsLine = Object.entries(score.dims)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");

  return `Eres un consultor senior de adopción de IA en pymes españolas. Vas a redactar un email
en español neutro (España) dirigido a un propietario de pyme. Tono cercano, sin jerga,
con verbos imperativos. NO usas emojis.

Datos de la empresa:
- Sector: ${answers.sector ?? "(no indicado)"}
- Tamaño: ${answers.tamano ?? "(no indicado)"}
- Madurez global: ${score.overall}/100 ("${level}")
- Madurez por dimensión: ${dimsLine}

Sus respuestas abiertas:
- Tarea repetitiva que más le quita tiempo: ${answers.open_repetitivo}
- Lo que le frena: ${answers.open_freno}
- Resultado tangible que querría en 90 días: ${answers.open_objetivo}

Catálogo de productos (úsalo solo cuando encaje, máximo dos enlaces):
- Ficha.es — para empresas que necesitan estructurar procesos antes de automatizar.
  https://ficha.es
- Ironclip / BPAC — para empresas listas para implantar IA gobernada (orquestación, auditoría).
  https://ironclip.com
- Itera.es — servicios de consultoría e implementación a medida.
  https://itera.es

Devuelve EXACTAMENTE este formato Markdown, sin texto adicional fuera:

## Tu plan AutonomIA · 30 / 60 / 90 días

**En 30 días — quick win**
[2-3 frases con la primera acción concreta, basada en la tarea repetitiva]

**En 60 días — automatización guiada**
[2-3 frases]

**En 90 días — gobernanza y métrica**
[2-3 frases que conecten con el objetivo a 90 días]

**Recomendación**
[1-2 productos del catálogo con su enlace, justificando por qué encaja con esta empresa]`;
}
