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
| `sync-ftp.mjs` | Descarga `_leads/leads.jsonl` desde IONOS por SFTP (mismo `lftp` y credenciales que el deploy) a una ruta local efímera (gitignored). Una pasada por heartbeat. |
| `ingest.mjs` | Detecta leads nuevos en `leads.jsonl` vía cursor (`.processed.json`). Una pasada por heartbeat, sin busy-loop. |
| `lib/render-email.mjs` | (ITEA-2789) Renderiza el borrador validado al email HTML branded (escape-then-markup como `_submit.php`). `Reply-To: hola@itera.es` + `Message-ID` con el `ref` para correlacionar replies. Salida `{to,subject,html,headers}` que mapea sobre `autonomia_smtp_send()` de `site/_mailer.php`. |
| `lib/track.mjs` | (ITEA-2789) Ledger append-only de envíos (`sends.jsonl`) + `computeReplyRate(sends, repliedRefs)`. Métrica primaria de reply-rate. |
| `prepare-send.mjs` | (ITEA-2789) `prepareReco(record, draft)` puro: valida → renderiza → fila de ledger. **No transmite, no escribe en IONOS.** El envío real queda tras el muestreo humano + transporte. |
| `fixtures/` | Lead de ejemplo, lead hostil (inyección) y borrador de muestra. |

## Flujo por heartbeat (rutina diaria)

1. `node sync-ftp.mjs` baja `_leads/leads.jsonl` desde IONOS por SFTP a
   `./_leads/leads.jsonl` (efímero, gitignored — contiene PII). Credenciales por
   env: `IONOS_SFTP_HOST/PORT/USER/PASSWORD` (+ `LEADS_REMOTE_PATH` opcional). Si
   aún no hay leads, escribe un fichero vacío y sale 0 (no-op). `--dry-run`
   imprime el script `lftp` con la contraseña redactada.
2. `node ingest.mjs --leads ./_leads/leads.jsonl --state .processed.json --json`
   imprime, por cada lead nuevo, el `SYSTEM` + `USER` que el agente debe responder.
3. El agente redacta el borrador siguiendo el formato del prompt.
4. `validateDraft(draft, openValues)` debe pasar. **Modo draft-only**: hasta que
   un humano muestree los primeros borradores reales (ITEA-3110 item 4), el
   borrador se publica para revisión, NO se envía automáticamente.
5. `prepareReco(record, draft)` (`prepare-send.mjs`) valida + renderiza el email
   branded + prepara la fila de ledger. **No envía**: el mensaje espera muestreo
   humano y el transporte (ITEA-2789).
6. Tras el visto bueno y con transporte disponible: el transporte (sender en
   IONOS que invoca `autonomia_smtp_send()` de `_mailer.php`, con fallback a
   `mail()`) envía y `recordSend(sends.jsonl, entry)` lo registra como `sent`.
   La reply-rate sale de `computeReplyRate(loadSends(...), repliedRefs)`, donde
   `repliedRefs` se cosecha de `hola@itera.es` por el `Message-ID`/ref.
7. `ingest.mjs --mark` marca los leads procesados (idempotente).

## Probar

```bash
cd tools/leads
node --test            # neutralización, inyección, validación, sync-ftp, render, tracking
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
