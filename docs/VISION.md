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

| Capacidad | Estado | Notas |
|---|---|---|
| Landing estática (hero + value prop) | en curso ([ITEAA-1465](#)) | base del sitio |
| Tutorial / contenidos por nivel de adopción | pendiente | usar `site/aprende/` |
| Cuestionario de madurez de IA (cerradas + abiertas) | pendiente | client-side; backend mínimo para email |
| Motor de recomendaciones + email personalizado | pendiente | LLM analiza respuestas abiertas; valida email antes de enviar |
| Blog con tutoriales | pendiente | plantilla común, slug en `site/blog/` |
| Comentarios externos moderados | pendiente | requiere SDK de validación anti-prompt-injection y validación de email |
| SDK + tool de validación de comentarios | pendiente | usado tanto en pre-publicación como por agentes que procesan tareas derivadas de un comentario |
| Hook "comentario → tarea Paperclip" | pendiente | depende del SDK anterior |

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
