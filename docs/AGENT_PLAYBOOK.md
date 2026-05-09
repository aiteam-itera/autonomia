# Agent Playbook — AutonomIA

Lee esto **antes** de tocar el repo. Cubre todo lo que un agente necesita saber para crear / editar páginas y dejar la web desplegada y validada.

## Premisas no negociables

1. **Todo cambio que se quiera ver en producción se hace en este repo, dentro de `site/`.** Nada se sube manualmente al SFTP — el SFTP es destino, no origen.
2. **`main` es la única rama.** No hay staging, no hay preview environments. PR opcional para revisión, pero el deploy se dispara con cada merge a `main` que toque `site/**`.
3. **El deploy es destructivo (`mirror --delete`).** Si borras un fichero del repo, desaparece de IONOS en el siguiente deploy.
4. **Solo se sirve `site/`.** Cualquier otra carpeta (`docs/`, `.github/`) se queda en GitHub.

## Antes de empezar (extracción de conocimiento)

Antes de crear o editar contenido, recopila al menos:

- **Objetivo de la tarea.** Qué página, sección o cambio se pide y por qué (qué decisión de negocio resuelve).
- **Audiencia.** Empresas que quieren adoptar IA (B2B, no técnico medio). Tono claro, ejemplos concretos.
- **Estado actual del sitio.**
  - Estructura: `site/index.html`, `site/assets/`, etc.
  - Estilos en `site/assets/style.css` (variables CSS en `:root`).
  - Ya existen secciones: hero, "Qué hacemos", "Hablemos".
- **Pipeline.** Push a `main` → `deploy.yml` → SFTP a IONOS → `validate.yml` corre y deja screenshots como artifact.
- **Restricciones.** Sitio estático puro (HTML/CSS/JS vainilla). No frameworks de build. No assets > 1MB sin consultar.
- **URL pública.** Mira `vars.PUBLIC_URL` del repo (o pregunta al humano si aún no está fijado).

Si falta alguna de estas piezas: **pregunta antes de codear** o crea una sub-issue para conseguirla.

## Flujo típico para "crear una nueva página"

1. **Plan corto** (en la issue): ruta de la página (`/sobre.html`), secciones, copy clave, enlaces desde dónde.
2. **Implementación** dentro de `site/`:
   - `site/sobre.html` con la misma estructura semántica que `index.html`.
   - Reutiliza `assets/style.css` y `:root` variables; añade clases nuevas si hace falta.
   - Si añades imágenes: `site/assets/img/<nombre>.webp` (optimizadas).
3. **Enlaza desde la home** o el menú correspondiente.
4. **Commit + push** a `main` (o PR + merge). El workflow `deploy.yml` corre solo.
5. **Validación visual:** abre el run de `validate.yml`, descarga el artifact `site-validation-<run-id>`, revisa `desktop.png`, `mobile.png` y `meta.json`. Si el `status` no es 200 o el screenshot está roto → revierte commit, no parchees encima.

## Flujo típico para "editar copy / arreglar bug"

1. Edita el HTML/CSS/JS afectado dentro de `site/`.
2. Push a `main`. Mismo pipeline, misma validación.

## Comandos útiles

```bash
# clonar (si vienes nuevo)
git clone https://github.com/aiteam-itera/autonomia
cd autonomia

# servidor local rápido para previsualizar antes de pushear
python3 -m http.server -d site 8080
# → http://localhost:8080

# verificar el SFTP a mano (raro, normalmente lo hace Actions)
curl -k --user "acc736162435:$IONOS_SFTP_PASSWORD" \
  "sftp://access878577274.webspace-data.io:22/autonomia/"
```

## Errores frecuentes

| Síntoma | Causa | Fix |
|---|---|---|
| Workflow `deploy.yml` falla en `lftp` con `Login failed` | secret `IONOS_SFTP_PASSWORD` ausente o caducado | repón el secret en repo settings |
| Workflow `validate.yml` falla con `No URL configured` | no hay `vars.PUBLIC_URL` | añade la variable o pásala con `url_override` al lanzar manualmente |
| El push no dispara deploy | no tocaste nada bajo `site/**` ni el workflow | confirma con `git diff --name-only HEAD~1` |
| Cambios suben pero el navegador ve la versión antigua | caché CDN/IONOS | esperar ~1 min o forzar `Ctrl+F5` |

## Qué **no** hacer

- No subir secretos al repo (passwords, tokens). Todo va a Actions secrets.
- No tocar `/autonomia/` desde un cliente SFTP a mano: si reescribes el repo borrarás tus cambios manuales.
- No introducir bundlers, frameworks (React/Vue) ni dependencias build sin discutirlo en una issue específica — rompe la simplicidad del pipeline.
- No commit-ear `node_modules/` ni artifacts de Playwright.
