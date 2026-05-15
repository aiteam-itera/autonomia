# AutonomIA — Visión y alcance

> Web 100% gobernada por IA, en español, que ayuda a pequeñas empresas a entender y adoptar la IA en su día a día. La propia web es un ejemplo vivo de operación autónoma con Paperclip.

## Por qué existe

La mayoría de pymes no saben **dónde empezar** con la IA. Los contenidos que hay online son demasiado técnicos, demasiado teóricos o están escritos en inglés. AutonomIA llena ese hueco con tres cosas:

1. **Educación en español orientada a negocio:** explicar IA por nivel de adopción (chats → automatizaciones → agentes → orquestadores), siempre con casos de uso reales para una pyme.
2. **Diagnóstico personalizado:** un cuestionario que evalúa la madurez de IA de la empresa y devuelve recomendaciones concretas (qué hacer ya, qué hacer después, qué evitar).
3. **Demostración palpable:** la propia web está mantenida por agentes de Paperclip — el visitante ve, en directo, lo que significa "operación 100% autónoma".

## Audiencia

- **Primaria:** propietario / gerente de pyme (5–50 empleados) en España y LATAM. Idioma natural: español. Conocimiento técnico bajo o medio.
- **Secundaria:** consultores y formadores que necesitan material claro para sus clientes.

## Vector de negocio

AutonomIA no monetiza directamente. Su trabajo es **calificar y traspasar** a:

- **Ficha.es** — para empresas que necesitan estructurar procesos antes de automatizar.
- **Ironclip / BPAC** — para empresas listas para implantar IA gobernada (orquestación, auditoría, control).
- **Itera.es** — para servicios de consultoría e implementación.

Toda CTA / recomendación de la web debe poder enlazar con uno de estos destinos.

## Capacidades funcionales (roadmap de producto)

> Estado al 2026-05-15 — sitio en vivo en [ia.itera.es](https://ia.itera.es/). El procedimiento de iteración diaria (rutina CEO) actualiza esta tabla cuando cambia el alcance.

| Capacidad | Estado | Notas |
|---|---|---|
| Landing estática (hero + value prop) | desplegada, en review (ITEAA-1465) | `site/index.html` con feed «Detrás de cada cambio» en vivo |
| Tutorial / contenidos por nivel de adopción | desplegada (4 niveles + empleo) | `site/aprende/01..04` + `contratar-en-la-era-agente.html` |
| Cuestionario de madurez de IA (cerradas + abiertas) | desplegada, en review (ITEAA-1536) | client-side en `site/cuestionario.html`; cae a `mailto:` si Worker no está configurado |
| Motor de recomendaciones + email personalizado | desplegado parcial — plan 30/60/90 determinista en vivo (ITEAA-1537) | `site/cuestionario.html` ya muestra plan al instante (commit `2e94418`); versión LLM + email sigue **pendiente de approval del board** para Cloudflare + Resend + Anthropic (approval [`1199055c`](#)) |
| Blog con tutoriales | desplegada, en review (ITEAA-1538) | `site/blog/_template.html` + 3 posts (`que-puede-hacer…`, `errores-caros…`, `plan-ia-30-60-90-dias-pyme`) |
| Captura de leads (formulario contacto) | desplegada, en review (ITEAA-1572) | home → `/api/contact` Worker → ticket en Paperclip |
| Servicios contratables | desplegada, ejemplos por sector + tabla de escenarios típicos (ITEAA-1574 + iter 2026-05-15) | `site/servicios.html`: cada paquete con 4 casos por sector y una tabla de 6 escenarios con precios reales |
| SEO + accesibilidad WCAG 2.2 AA | desplegada (ITEAA-1575) | sitemap, robots, OG/Twitter cards, skip-link, focus visible |
| Comentarios externos moderados + SDK validación | código listo, en review (ITEAA-1539) | SDK 22/22 tests verdes en `tools/comment-validator/`; Worker pide secrets de Cloudflare/Resend para entrar en producción (mismo approval que el motor de recomendaciones) |
| Hook «comentario → tarea Paperclip» | código listo, blocked por approval | implementado en [`worker/src/paperclip.ts`](https://github.com/aiteam-itera/autonomia/blob/main/worker/src/paperclip.ts); se activa al deployar el Worker con `PAPERCLIP_*` secrets |

## Principios de diseño

- **Web estática vainilla.** HTML + CSS + JS sin framework. Todo lo que hace falta para un sitio rápido, indexable y trivial de desplegar a IONOS.
- **Mobile-first.** La mayoría del tráfico llegará por móvil desde redes sociales o búsquedas locales.
- **Accesibilidad WCAG AA.** Contraste, foco visible, alt text, jerarquía semántica.
- **SEO desde el primer día.** Cada página debe tener `<title>`, `meta description`, Open Graph, JSON-LD donde aplique.
- **Tono:** cercano, sin jerga, ejemplos concretos. "Te explicamos" en lugar de "se explicará".

## Principios de gobernanza

- El repo es la **única fuente de verdad**. Nadie sube nada a IONOS por SFTP a mano.
- Cualquier agente que toque el repo lee primero `docs/AGENT_PLAYBOOK.md`.
- Los cambios destructivos (borrar páginas, mover URLs, romper enlaces) se discuten en una issue antes de hacerse.
- Los comentarios externos pasan **siempre** por el SDK de validación antes de generar tarea para un agente.

## Cómo se decide la siguiente iteración

- El CEO ejecuta una rutina diaria sobre este proyecto: revisa estado, prioriza la próxima capacidad del roadmap, abre o asigna issues, y deja el siguiente paso explícito.
- Cualquier humano del board puede sobreescribir prioridades creando o reasignando una issue.
