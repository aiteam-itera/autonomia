# Wave 1 — Plan de adquisición de tráfico (AutonomIA)

**Estado:** funnel completo e instrumentado, **0 visitas humanas** (`_analytics/a.log` vacío al 2026-05-23).
**Restricción ligante:** distribución, no CRO ni on-page SEO (ya resueltos).
**Métrica objetivo Wave 1:** primeras **50 visitas únicas** al sitio y **≥5 inicios** del cuestionario en 14 días.

> Dominio nuevo, autoridad cero. El SEO orgánico tarda 3-6 meses. Wave 1 prioriza canales de
> distribución directa que producen tráfico **esta semana**, mientras el SEO madura en paralelo.

---

## ICP (a quién perseguimos primero)

PYME española de servicios, 5-50 empleados, con trabajo repetitivo evidente:
gestorías/asesorías, despachos legales, clínicas, agencias, ecommerce pequeño, fintech/legaltech (encaja con catálogo Ficha.es / Ironclip / Itera.es).
Dolor: tareas manuales repetidas (facturas, emails, datos entre herramientas) y la sensación de "deberíamos usar IA pero no sé por dónde".

## Activo gratuito que ofrecemos (el gancho)

- **Cuestionario "¿Qué deberías automatizar primero?"** → `https://ia.itera.es/cuestionario.html`
- **Calculadora de ROI de automatización** → `https://ia.itera.es/calculadora.html`
- **Test de madurez IA** → `https://ia.itera.es/herramienta/madurez.html`

Promesa: en <3 minutos, sin registro previo, una recomendación concreta de tu primer paso.

---

## Canales — qué puedo ejecutar yo (autónomo) vs. qué necesita el board

### A. Autónomo (CEO agente — ya en marcha o ejecutable sin credenciales)
1. **IndexNow** (Bing/Yandex/DuckDuckGo) — `tools/indexnow.mjs` + key `1842ee5ca6e204cd3eef5633f8e18ea8.txt` en raíz; pingea todas las URLs del sitemap en cada deploy (paso en `deploy.yml`). ✅ implementado.
2. **Contenido SEO long-tail** — seguir profundizando `/aprende/` y `/blog/` sobre consultas reales ("automatizar facturas pyme", "cuánto cuesta un proceso manual"). Compone a medio plazo.
3. **Schema.org / datos estructurados** — mejorar CTR en SERP (FAQPage, Organization). Pendiente de priorizar.

### B. Necesita el board / un humano (NO puedo hacerlo sin cuentas/credenciales) — **UNBLOCK**
1. **Google Search Console** — verificar dominio y enviar sitemap. *Unblock owner: board* (acceso DNS/registro itera.es). Sin esto Google no nos descubre rápido.
2. **LinkedIn (perfil Itera / personal del fundador)** — 3-5 posts/semana mostrando un output real del cuestionario + CTA. *Unblock owner: board* (cuenta + tono de marca). **Mayor palanca de tráfico humano inmediato.**
3. **Email directo a red existente** — clientes/contactos de Itera.es/Ficha.es: "hemos hecho un diagnóstico gratis de automatización, pruébalo". *Unblock owner: board* (lista de contactos + consentimiento).
4. **Comunidades PYME** (grupos sectoriales, foros de gestorías, Slack/Discord de emprendedores) — compartir el activo gratuito como recurso. *Unblock owner: board* (cuentas + reputación).

---

## Mensajes listos para enviar (copy aprobado para humano)

**LinkedIn (post):**
> ¿Sabes cuál sería la **primera** tarea que tu empresa debería automatizar con IA?
> Hemos montado un diagnóstico gratuito de 3 minutos: respondes sobre tu negocio y te dice
> tus 3 mejores oportunidades de automatización, el valor estimado y por dónde empezar.
> Sin registro para verlo. → ia.itera.es/cuestionario.html

**Email a red existente (asunto: "Tu primer paso de IA, en 3 minutos"):**
> Hola [nombre],
> Estamos ayudando a PYMEs a dar su primer paso real con IA sin humo. Hicimos una herramienta
> gratuita que en 3 minutos te dice qué deberías automatizar primero y cuánto te ahorraría.
> ¿Le echas un vistazo y me dices si tiene sentido para [empresa]? → ia.itera.es/cuestionario.html

---

## Definición de hecho (Wave 1)
- [ ] GSC verificado + sitemap enviado (board)
- [ ] ≥1 canal humano activo (LinkedIn o email a red) (board)
- [ ] IndexNow pingeando en cada deploy (CEO) ✅
- [ ] 50 visitas únicas y ≥5 inicios de cuestionario registrados en `a.log`

## Validación
Revisar `_analytics/a.log` (vía `tools/analytics-baseline.mjs`) a los 7 y 14 días. Si un canal genera inicios de cuestionario, doblar apuesta; si no, matar y probar el siguiente.
