# AutonomIA

> Sitio web 100% gobernado por IA. Aconseja a empresas sobre cómo usar la IA y cómo automatizar sus procesos.

Este repositorio es el **único origen de verdad** del sitio. Cualquier cambio (nueva página, copy, asset, refactor de estilos) se hace aquí, se mergea a `main`, y el pipeline de GitHub Actions lo despliega automáticamente al hosting IONOS por SFTP. Después se valida visualmente con un screenshot que se sube como artefacto del run.

## Pipeline (resumen)

```
edit → commit → push to main → GitHub Actions → SFTP a IONOS → screenshot de validación
```

1. Un agente (o humano) edita ficheros bajo `site/`.
2. Push a `main` (o merge de PR).
3. El workflow `.github/workflows/deploy.yml` sincroniza `site/` contra la carpeta `/autonomia/` del usuario SFTP `acc736162435` en `access878577274.webspace-data.io`.
4. El job de validación abre la URL desplegada con Playwright, captura un screenshot y lo adjunta como artefacto del run.

## Layout

```
autonomia/
├── README.md                  ← este fichero
├── site/                      ← contenido estático desplegado tal cual a IONOS
│   ├── index.html             ← landing
│   ├── assets/                ← css / js / img
│   └── robots.txt
├── .github/
│   └── workflows/
│       ├── deploy.yml         ← deploy SFTP a IONOS
│       └── validate.yml       ← validación visual opcional (manual / post-deploy)
├── worker/                   ← Cloudflare Worker (cuestionario, comentarios, leads /api/contact)
├── tools/                    ← utilidades (validador de comentarios, etc.)
├── tests/                    ← Playwright e2e contra `site/` (form, honeypot)
└── docs/
    ├── DEPLOYMENT.md          ← cómo está cableado el deploy
    └── AGENT_PLAYBOOK.md      ← qué tiene que saber un agente para crear/editar páginas aquí
```

Nada fuera de `site/` se sirve. Si necesitas un asset en producción, va dentro de `site/`.

## Acceso y credenciales

- **Hosting:** IONOS Multiweb, host `access878577274.webspace-data.io`, puerto `22`, protocolo `SFTP`, usuario `acc736162435`. La contraseña vive en el secret de Paperclip `ionosftpaccess` y debe estar replicada como secret de GitHub Actions con el nombre `IONOS_SFTP_PASSWORD`.
- **GitHub:** repo `aiteam-itera/autonomia`. PAT en el secret de Paperclip `aiteamGithubAll`.
- **URL pública:** pendiente de confirmación — ver `docs/DEPLOYMENT.md`.

## Para agentes

Lee `docs/AGENT_PLAYBOOK.md` antes de tocar nada. Resumen:

- Edita siempre dentro de `site/`.
- No metas binarios pesados; usa `assets/img/` con imágenes optimizadas.
- Cada PR debe pasar por el deploy a `main` (no hay entornos previos).
- Si rompes el sitio, revierte el commit; el siguiente push redeploya.
