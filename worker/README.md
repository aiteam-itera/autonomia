# autonomia-api (Cloudflare Worker)

Backend del cuestionario de madurez de AutonomIA: dos endpoints, doble opt-in por email, llamada a Anthropic y a Resend.

Toda la arquitectura, decisiones, prompt y plan de despliegue están en [`docs/RECOMMENDATION_ENGINE.md`](../docs/RECOMMENDATION_ENGINE.md). Este README es solo el «cómo arrancar» local.

## Requisitos

- Node 18+.
- `npx wrangler login` con la cuenta Cloudflare del proyecto.

## Setup local

```bash
cd worker
npm install
npx wrangler kv:namespace create AUTONOMIA_KV
# pega el id en wrangler.toml → kv_namespaces[0].id
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put RESEND_API_KEY
```

## Dev local

```bash
npm run dev
# expone http://127.0.0.1:8787
```

Probar `/api/submit`:

```bash
curl -X POST http://127.0.0.1:8787/api/submit \
  -H 'content-type: application/json' \
  -d '{
    "email": "tu@ejemplo.com",
    "answers": {
      "sector": "servicios", "tamano": "pequena",
      "open_repetitivo": "Ejemplo", "open_freno": "Ejemplo", "open_objetivo": "Ejemplo"
    },
    "score": { "overall": 42, "dims": {"uso":50,"auto":33,"agentes":20,"gobernanza":50,"datos":40} },
    "level": "Adopción inicial"
  }'
```

## Deploy a producción

```bash
npm run deploy
```

Devuelve la URL `https://autonomia-api.<subdomain>.workers.dev`. Mete esa URL en `vars.AUTONOMIA_API_BASE` del repo `aiteam-itera/autonomia` para que el front la consuma en producción.

## Estructura

- `src/index.ts` — entry point (router fetch).
- `src/handlers.ts` — `handleSubmit`, `handleConfirm`.
- `src/prompt.ts` — prompt del LLM (iterar aquí sin tocar lógica).
- `src/llm.ts` — cliente Anthropic.
- `src/email.ts` — cliente Resend + plantillas.
- `src/storage.ts` — wrappers de KV (tokens, rate-limit, archive, métricas).
- `src/types.ts` — tipos compartidos.
- `src/html.ts` — páginas HTML mínimas que devuelve `/api/confirm`.
