// AutonomIA / Itera product catalog. The recommendation MUST reference at
// least one of these (by name or URL) — see validate-draft.mjs.
export const CATALOG = [
  {
    id: "ficha",
    name: "Ficha.es",
    url: "https://ficha.es",
    fit: "empresas que necesitan estructurar y digitalizar sus procesos antes de automatizar",
  },
  {
    id: "ironclip",
    name: "Ironclip / BPAC",
    url: "https://ironclip.com",
    fit: "empresas listas para implantar IA gobernada: orquestación de agentes, auditoría y trazabilidad",
  },
  {
    id: "itera",
    name: "Itera.es",
    url: "https://itera.es",
    fit: "consultoría e implementación a medida cuando hace falta acompañamiento humano",
  },
];

// Names + URLs the draft validator accepts as a valid catalog reference.
export const CATALOG_TOKENS = CATALOG.flatMap((p) => [p.name, p.url]);
