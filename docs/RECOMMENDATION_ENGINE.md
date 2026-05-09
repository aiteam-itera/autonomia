# Motor de recomendaciones — AutonomIA

> Backend del cuestionario de madurez. Recibe las respuestas, valida el email del visitante por doble opt-in y genera un plan personalizado a 30/60/90 días con un LLM. Ver [VISION.md](VISION.md) capacidad #3 e issue [ITEAA-1537](#).

## Decisiones arquitectónicas

| Pieza | Elección | Por qué |
|---|---|---|
| Hosting backend | **Cloudflare Workers** | Free tier (100k req/día), deploy en segundos, sin servidor que mantener, KV integrado, edge global. IONOS Multiweb es estático puro y no permite código server-side. |
| Storage | **Cloudflare KV** | Free tier (1k writes/día, 100k reads/día). Suficiente para tokens efímeros (TTL <24h). Sin BD relacional. |
| Email | **Resend** | API simple (`POST /emails`), free tier 3.000 emails/mes, dominio propio con DKIM, residencia EU disponible, DX limpio. |
| LLM | **Anthropic Claude (claude-haiku-4-5)** | Coste objetivo <0,01 €/recomendación. Calidad sobrada para 3 párrafos en español. Ya hay relación contractual con Anthropic vía Paperclip. |
| Lenguaje del Worker | **TypeScript** sobre `@cloudflare/workers-types` | Tipos del runtime, sin transpilación adicional (Wrangler lo gestiona). |
| Validación de schemas | **Manual con guards** (sin Zod) | Mantener el bundle <50 kB. Solo dos endpoints. |

Trade-offs aceptados:

- Cloudflare Workers introduce un segundo proveedor (además de IONOS y GitHub). Mitigación: el front estático sigue en IONOS — si Workers cae, el cuestionario sigue visible aunque sin envío de email.
- Resend bloquea dominios «de prueba» tras una semana; necesitamos el dominio público real verificado con DKIM/SPF antes del primer envío real.
- Claude Haiku puede dar respuestas demasiado breves; si pasa, subir a `claude-sonnet-4-6` por config sin redeploy.

## Arquitectura

```
┌────────────────┐       ┌──────────────────────────┐       ┌──────────────────┐
│  Visitante     │       │  Cloudflare Worker        │       │  Resend          │
│  cuestionario  │──1───▶│  POST /api/submit         │──2──▶│  Email "confirma │
│  .html         │       │                           │       │  tu email"       │
│  (IONOS)       │       │  • genera token (uuid)    │       └──────────────────┘
│                │       │  • guarda payload en KV   │
│                │       │    (TTL 24h)              │
│                │       │  • envía verify email     │
│                │       │  • rate-limit por IP+email│
│                │◀──5───│                           │
│                │       │  GET /api/confirm?token=  │       ┌──────────────────┐
│                │──4───▶│                           │──6──▶│  Anthropic API    │
│                │       │  • valida token           │       │  claude-haiku-4-5│
│                │       │  • lee payload            │       └──────────────────┘
│                │       │  • llama a Claude         │       ┌──────────────────┐
│                │       │  • envía recomendación    │──7──▶│  Resend          │
│                │       │  • marca token consumido  │       │  Email "tu plan" │
│                │       │  • muestra "ok" en HTML   │       └──────────────────┘
└────────────────┘       └──────────────────────────┘
        │                         ▲
        │                         │ KV
        │                  ┌──────┴───────┐
        │                  │ AUTONOMIA_KV │
        │                  │ tokens/<id>  │  ← payload pendiente, TTL 24h
        │                  │ rl/<ip>      │  ← contador rate-limit, TTL 1h
        │                  │ rl/<email>   │
        │                  └──────────────┘
```

### Flujo

1. El visitante completa el cuestionario y pulsa «Recibir plan personalizado». El JS llama a `POST /api/submit` con `{respuestas, email, scoreOverall, scoreDims}`.
2. El Worker:
   - valida payload (email RFC-básico, respuestas obligatorias presentes),
   - aplica rate-limit (3 envíos/hora por IP, 1 envío/hora por email),
   - genera `token = crypto.randomUUID()`,
   - guarda en KV `tokens/<token>` con TTL 24h,
   - envía email de verificación con enlace `https://<PUBLIC_URL>/confirmar.html?token=<token>` o, si preferimos resolver en el Worker, `https://<API_BASE>/api/confirm?token=<token>` que renderiza una página de gracias.
3. (Front) El usuario recibe `Subject: Confirma tu email · AutonomIA` con un único CTA.
4. El usuario pulsa el enlace → `GET /api/confirm?token=...`.
5. El Worker:
   - valida token (existencia + no consumido),
   - marca consumido (`status=used`),
   - lee el payload original,
   - llama a Anthropic con el prompt definido más abajo (max_tokens 800),
   - envía email de recomendación a Resend,
   - responde HTML mínimo «¡Listo, revisa tu correo!».
6. Llamada a Anthropic API con `claude-haiku-4-5`.
7. Llamada a Resend con el email final («Tu plan AutonomIA: 30 / 60 / 90 días»).

### Respuesta del usuario en el front

`cuestionario.html` ya tiene un botón «Recibir plan personalizado». Se sustituye `mailto:` por `fetch(API_BASE + '/api/submit', {method:'POST', body: JSON.stringify(payload)})` cuando `window.AUTONOMIA_API_BASE` está definido. Si no está definido (entorno aún sin backend), cae al `mailto:` actual y muestra el aviso «pendiente conectar el motor». Esto permite empujar el front sin romper la home antes del aprovisionamiento.

## Endpoints

### `POST /api/submit`

**Request body** (`application/json`):

```json
{
  "email": "ana@ejemplo.com",
  "answers": {
    "sector": "servicios",
    "tamano": "pequena",
    "uso_frecuencia": "2",
    "...": "...",
    "open_repetitivo": "Cada lunes copio pedidos del email al ERP a mano…",
    "open_freno": "...",
    "open_objetivo": "..."
  },
  "score": { "overall": 42, "dims": { "uso": 50, "auto": 33, "agentes": 20, "gobernanza": 50, "datos": 40 } },
  "level": "Adopción inicial"
}
```

**Responses**:

- `202 Accepted` `{ "ok": true, "message": "Verifica tu email" }` — email de verificación encolado.
- `400 Bad Request` `{ "ok": false, "error": "invalid_email" | "missing_field" }`.
- `429 Too Many Requests` `{ "ok": false, "error": "rate_limited", "retryAfterSeconds": 3600 }`.
- `500` cuando Resend o KV fallan; nunca devolver detalle del error al cliente.

### `GET /api/confirm?token=<uuid>`

**Responses** (siempre `text/html`):

- `200` página «¡Listo!» con copy «en pocos segundos te llegará el plan personalizado».
- `200` página «Este enlace ya se usó» si el token está consumido.
- `404` página «Enlace no válido» si el token no existe.
- `410 Gone` si caducó (KV ya no lo tiene → mismo error que 404 visualmente).

### Prompt del LLM

Vive en `worker/src/prompt.ts` para que un agente lo pueda iterar sin tocar la lógica.

```text
Eres un consultor senior de adopción de IA en pymes españolas. Vas a redactar un email
en español neutro (España) dirigido a un propietario de pyme. Tono cercano, sin jerga,
con verbos imperativos. NO usas emojis.

Datos de la empresa:
- Sector: {{sector}}
- Tamaño: {{tamano}}
- Madurez global: {{score.overall}}/100 ("{{level}}")
- Madurez por dimensión: {{score.dims}}

Sus respuestas abiertas:
- Tarea repetitiva que más le quita tiempo: {{open_repetitivo}}
- Lo que le frena: {{open_freno}}
- Resultado tangible que querría en 90 días: {{open_objetivo}}

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
[2-3 frases con la primera acción concreta, basada en open_repetitivo]

**En 60 días — automatización guiada**
[2-3 frases]

**En 90 días — gobernanza y métrica**
[2-3 frases que conecten con open_objetivo]

**Recomendación**
[1-2 productos del catálogo con su enlace, justificando por qué encaja con esta empresa]
```

El email final = preámbulo fijo (saludo + 1 frase) + Markdown→HTML del LLM + pie con enlace de baja.

## Secrets y variables (Cloudflare)

Cuando el board apruebe, hay que crear en el dashboard de Cloudflare → Worker → Settings:

### Secrets (encriptados)
- `ANTHROPIC_API_KEY` — clave de la org Anthropic; misma cuenta que Paperclip o subcuenta de proyecto.
- `RESEND_API_KEY` — clave del proyecto Resend «autonomia-prod».

### Variables (texto plano, OK en logs)
- `PUBLIC_URL` — URL pública del sitio (`https://autonomia.itera.es` o equivalente, una vez fijado).
- `API_BASE` — URL del propio Worker (`https://autonomia-api.<workers.dev>` mientras no haya dominio).
- `EMAIL_FROM` — `AutonomIA <hola@autonomia.itera.es>` una vez verificado el dominio en Resend; mientras tanto `onboarding@resend.dev`.
- `LLM_MODEL` — `claude-haiku-4-5-20251001` (configurable sin redeploy).
- `LLM_MAX_TOKENS` — `800`.
- `DAILY_LLM_LIMIT` — `200` (corte duro: cuando `kv:metrics/llm-calls/<YYYY-MM-DD>` supere esto, el Worker responde 503 con copy «hemos llegado al límite del día, prueba mañana»).

### Bindings (en `wrangler.toml`)
- `AUTONOMIA_KV` — namespace KV creado vía `wrangler kv:namespace create AUTONOMIA_KV`.

### Réplicas en Paperclip (`project.env`)
Para que cualquier agente futuro pueda hacer redeploy sin pedir credenciales al humano, los mismos `ANTHROPIC_API_KEY` y `RESEND_API_KEY` se guardan también como secrets del proyecto AutonomIA (junto a `aiteamGithubAll` y `ionosftpaccess`). El workflow `deploy-worker.yml` los inyecta a Wrangler.

## Despliegue

El Worker vive en `worker/` y se despliega vía GitHub Actions (`.github/workflows/deploy-worker.yml`, pendiente de crear cuando los secrets estén disponibles).

```bash
# en local, con wrangler instalado:
cd worker
npx wrangler kv:namespace create AUTONOMIA_KV
# pega el id resultante en wrangler.toml → kv_namespaces[0].id
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler deploy
```

Tras el primer deploy, Cloudflare devolverá una URL `https://autonomia-api.<subdomain>.workers.dev`. Esa URL alimenta `vars.AUTONOMIA_API_BASE` del repo (Settings → Variables) para que el front la lea en build.

## Anti-abuso y privacidad

- **Rate limit por IP**: 3 envíos/hora (`kv:rl/ip/<ip>`).
- **Rate limit por email**: 1 envío/hora (`kv:rl/email/<email>`).
- **Token TTL**: 24h hard, single-use.
- **Coste**: corte diario duro `DAILY_LLM_LIMIT` para impedir factura sorpresa.
- **GDPR**:
  - El front muestra texto explícito antes de enviar: «Al enviar aceptas que procesemos tus respuestas para generar una recomendación. Las almacenamos 90 días.»
  - El email de verificación incluye «si no fuiste tú, ignora este mensaje, los datos se borrarán automáticamente en 24h».
  - El email de recomendación incluye footer con email de baja (`baja@autonomia.itera.es`).
  - No se persisten respuestas sin email confirmado: tras consumir el token la respuesta se mueve a `kv:archive/<email>` con TTL 90 días, y luego se purga sola.

## Cambiar el prompt o el modelo

1. Edita `worker/src/prompt.ts` (prompt) o `LLM_MODEL` (variable de entorno) en Cloudflare.
2. PR + merge a `main`. Si solo cambia el prompt → redeploy del Worker. Si cambia `LLM_MODEL` → solo `wrangler secret put` o tocar el var; sin redeploy.
3. Validación manual: dispara `POST /api/submit` con un payload de prueba apuntando a un email de QA. Comprueba que llega la verificación, pulsa, comprueba que llega la recomendación y revísala.

## Pendientes humanos (board)

1. Aprobar el conjunto de proveedores (Cloudflare Workers + Resend + Anthropic) y crear las cuentas/subcuentas que correspondan.
2. Cargar `ANTHROPIC_API_KEY` y `RESEND_API_KEY` como secrets del proyecto Paperclip AutonomIA (UI del board, igual que `ionosftpaccess`).
3. Decidir el dominio público (p. ej. `autonomia.itera.es`) y verificarlo en Resend (registros DKIM/SPF).
4. Crear el namespace KV en Cloudflare desde el dashboard o autorizar al CEO a hacerlo vía API.
5. Una vez cargados los secrets, asignar [ITEAA-1537](#) → `todo` para que el CEO retome el deploy.
