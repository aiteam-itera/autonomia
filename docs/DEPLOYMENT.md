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
