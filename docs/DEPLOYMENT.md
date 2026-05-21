# Deployment — AutonomIA

End-to-end pipeline: **GitHub `main` → SFTP a IONOS Multiweb → screenshot de validación**.

## Componentes

| Pieza | Dónde vive | Notas |
|---|---|---|
| Repo | `aiteam-itera/autonomia` | rama `main` única; sin entornos previos |
| Hosting | IONOS Multiweb | usuario chrooteado a una carpeta del Multiweb |
| Carpeta destino | `/autonomia/` (relativa al chroot del usuario SFTP) | creada por CEO el 2026-05-09 |
| Workflow deploy | `.github/workflows/deploy.yml` | sincroniza `site/` con la carpeta remota usando `lftp mirror -R --delete` |
| Workflow validación | `.github/workflows/validate.yml` | Playwright screenshots desktop+mobile, sube como artifact |

## SFTP

| Campo | Valor |
|---|---|
| Host | `access878577274.webspace-data.io` |
| Puerto | `22` |
| Protocolo | `SFTP` |
| Usuario | `acc736162435` |
| Password | secret `IONOS_SFTP_PASSWORD` (mismo valor que el secret de Paperclip `ionosftpaccess`) |

## Variables y secrets de GitHub Actions

Configuradas en **Repo → Settings → Secrets and variables → Actions**.

### Secrets (sensible, no se imprime)
- `IONOS_SFTP_PASSWORD` — contraseña SFTP del usuario `acc736162435`.

### Variables (público, se ve en logs)
- `IONOS_SFTP_HOST` = `access878577274.webspace-data.io`
- `IONOS_SFTP_PORT` = `22`
- `IONOS_SFTP_USER` = `acc736162435`
- `IONOS_REMOTE_DIR` = `/autonomia`
- `PUBLIC_URL` = (pendiente — la URL pública que sirve el contenido subido a `/autonomia/`)

> Nota: el usuario SFTP de IONOS está chrooteado, así que `/autonomia` desde su sesión equivale a `multiweb/<carpeta-asignada>/autonomia` desde el panel de IONOS.

## Cómo dispara el deploy

- Cualquier push a `main` que toque `site/**` o el propio workflow → corre `deploy.yml`.
- Si el deploy termina OK → dispara `validate.yml` con `commit_sha`.
- `validate.yml` también se puede correr manualmente desde la UI de Actions con `url_override`.

## Cómo verificar a mano

```bash
# listar la carpeta remota
curl -k --user "acc736162435:$IONOS_SFTP_PASSWORD" \
  "sftp://access878577274.webspace-data.io:22/autonomia/"

# subir un fichero de prueba
echo "hello" > /tmp/hello.txt
curl -k --user "acc736162435:$IONOS_SFTP_PASSWORD" \
  -T /tmp/hello.txt \
  "sftp://access878577274.webspace-data.io:22/autonomia/hello.txt"
```

## Pendientes (humano)

1. Crear los **Variables y Secrets** de Actions listados arriba en `aiteam-itera/autonomia`. CEO los crea por API si tiene `repo` scope sobre el PAT — si no, hacerlo a mano una vez.
2. Confirmar la **URL pública** que sirve `/autonomia/` y meterla en `vars.PUBLIC_URL` (o en `url_override` al lanzar `validate.yml` manualmente).
3. Validar el primer deploy (push, ver run verde, descargar el artifact `site-validation-*` del run de validación).

## Captura de leads first-party (sin Cloudflare) — ITEAA-1775

Mientras el Worker `autonomia-api` siga bloqueado (ITEAA-1537/1773), el funnel captura
leads con PHP first-party en IONOS, espejo del colector de analytics `site/_a.php`:

| Endpoint (same-origin) | Lo usa | Payload |
|---|---|---|
| `POST /_submit.php`  | `cuestionario.html` (CTA email del diagnóstico) | `{email, answers, score, level, source}` |
| `POST /_contact.php` | home `#contacto` (`assets/contact.js`) y `herramienta/madurez.html` | `{name, email, sector, message, source, paquete, score?, level?}` |

- Ambos validan el email, descartan el honeypot `website` y **añaden una línea JSON** a
  `/_leads/leads.jsonl`, **fuera del docroot** (hermano de `/autonomia/`, igual que `/_analytics`).
  No es web-accesible (`/_leads/...` → 404). Sólo se guarda lo que el visitante envía (GDPR-mínimo).
- El JS resuelve el endpoint como `Worker real (si está cableado) || PHP same-origin`; el
  `mailto:` queda sólo como último recurso ante fallo de red. Así no se pierde ningún lead.
- **Notificación best-effort:** cada endpoint intenta `mail()` a `hola@itera.es` (From `no-reply@itera.es`).
  Si IONOS no tiene `mail()` disponible, el lead se guarda igual (`mailed:false` en la respuesta) y
  el seguimiento es manual leyendo `leads.jsonl`.

### Cómo lee los leads HeadOfGrowth (vía SFTP)

```bash
# El fichero vive FUERA de /autonomia (en el padre del chroot SFTP).
curl -k --user "acc736162435:$IONOS_SFTP_PASSWORD" \
  "sftp://access878577274.webspace-data.io:22/_leads/leads.jsonl"
```

Si el padre del chroot no fuese escribible, el fallback es `/autonomia/_leads/leads.jsonl`
protegido con `.htaccess` (`Require all denied`). Verificar tras el primer deploy cuál de los dos quedó.

## Worker (`worker/`) — secrets adicionales para captura de leads

El formulario de `#contacto` (home) llama al endpoint `POST /api/contact` del Worker
`autonomia-api` y el Worker crea un issue en Paperclip por cada lead. Para que la integración
funcione hay que tener configurados, además de los secrets ya documentados en
`worker/wrangler.toml`:

- `PAPERCLIP_API_URL`              — `https://app.paperclip.ing` (o el self-host correspondiente).
- `PAPERCLIP_API_KEY`              — service key del agente que crea los issues.
- `PAPERCLIP_COMPANY_ID`           — id de la company AutonomIA.
- `PAPERCLIP_ASSIGNEE_AGENT_ID`    — fallback assignee (CEO mientras no haya un agente Sales).
- `PAPERCLIP_LEAD_ASSIGNEE_AGENT_ID` (opcional) — assignee específico para leads.
- `PAPERCLIP_LEAD_PARENT_ID`         (opcional) — issue padre que agrupa leads (para el board).
- `PAPERCLIP_PROJECT_ID`             (opcional) — fija los issues al proyecto AutonomIA.
- `RESEND_API_KEY` + `EMAIL_FROM`  — necesarios para enviar el email de "te respondemos en 24h".
  Si faltan, el Worker sigue creando el issue pero el ack al usuario se omite (log
  `lead_ack_email_skipped_no_resend`).

Si falta alguno de los `PAPERCLIP_*` el Worker continúa aceptando el envío y archiva el lead en
KV (`contact/leads/...`), pero registra `paperclip_lead_integration_not_configured` y no crea
el issue. Recuperación manual: leer el archivo de KV y crear el issue a mano.

### Front-end → Worker

La home incluye `<meta name="autonomia-api-base">` con un placeholder. En producción hay que
sobreescribirlo con la URL real del Worker, ya sea:

- editando `site/index.html` y poniendo el dominio definitivo, o
- inyectando `window.AUTONOMIA_API_BASE = "https://autonomia-api.<sub>.workers.dev"` en una
  variante del HTML antes del `<script>` de `contact.js`.

Mientras `autonomia-api-base` siga apuntando a `*.example.workers.dev`, `contact.js` deshabilita
el botón con un mensaje claro y un `mailto:` de fallback — así no se pierden leads en el periodo
entre publicar la nueva home y desplegar el Worker.
