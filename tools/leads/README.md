# tools/leads — motor de recomendación in-house

Toolkit que usa el agente IronBrain para convertir cada lead del cuestionario en
un borrador de email personalizado. **El LLM es el propio agente**: no hay
`anthropicApiKey` externa, ni Cloudflare Worker, ni Resend. Sustituye el plan
30/60/90 determinista descrito en `docs/RECOMMENDATION_ENGINE.md`.

Cubre ITEA-2788 (pipeline) sobre la defensa de ITEA-2787 (guardrail anti
prompt-injection). No se despliega a IONOS — solo `site/**` se sincroniza; este
código corre en el heartbeat del agente.

## Piezas

| Fichero | Rol |
|---|---|
| `lib/sanitize.mjs` | Aísla y neutraliza el texto libre del lead, lo envuelve en `<lead_input>`. Detecta inyección para auditoría. |
| `lib/catalog.mjs` | Catálogo de productos (Ficha.es / Ironclip-BPAC / Itera.es). |
| `lib/prompt.mjs` | `SYSTEM_PROMPT` (marco de seguridad) + `buildPrompt(record)`. |
| `lib/validate-draft.mjs` | Valida el borrador antes del envío: cita literal, referencia de catálogo, sin fuga del prompt, sin inyección reflejada, longitud. |
| `ingest.mjs` | Detecta leads nuevos en `leads.jsonl` vía cursor (`.processed.json`). Una pasada por heartbeat, sin busy-loop. |
| `fixtures/` | Lead de ejemplo, lead hostil (inyección) y borrador de muestra. |

## Flujo por heartbeat (rutina diaria)

1. La rutina sincroniza `_leads/leads.jsonl` desde IONOS (FTP `ionosftpaccess`)
   a una ruta local — fuera del docroot, igual que lo escribe `_submit.php`.
2. `node ingest.mjs --leads <ruta> --state .processed.json` imprime, por cada
   lead nuevo, el `SYSTEM` + `USER` que el agente debe responder.
3. El agente redacta el borrador siguiendo el formato del prompt.
4. `validateDraft(draft, openValues)` debe pasar antes de pasar a ITEA-2789.
5. `ingest.mjs --mark` marca los leads procesados (idempotente).

## Probar

```bash
cd tools/leads
node --test            # 12 casos: neutralización, inyección, validación
```

## Garantías de seguridad (ITEA-2787)

- **Aislamiento**: todo dato del lead va dentro de `<lead_input>`; el system
  prompt declara que ese bloque son DATOS, nunca instrucciones.
- **Neutralización**: se eliminan caracteres de control / zero-width / bidi, se
  trunca por campo y se convierten `<`/`>` en guillemets (`‹`/`›`), por lo que
  ningún payload puede cerrar el bloque ni falsear etiquetas de sistema.
- **Privilegio mínimo**: estos módulos son funciones puras sin efectos (sin
  envío, sin escritura de FS, sin claves). El envío vive en ITEA-2789.
- **Validación de salida**: `validateDraft` rechaza fuga de prompt, inyección
  reflejada y relleno genérico sin cita literal.
- **Auditoría**: `audit.flags` registra los intentos de inyección detectados
  para muestreo humano inicial.
