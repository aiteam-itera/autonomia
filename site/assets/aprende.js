/*
 * AutonomIA — progreso del currículo "Aprende".
 * Marca cada nivel como visitado en localStorage y refleja el avance en
 * la barra de progreso y los checks de la home de /aprende/.
 *
 * Activa el comportamiento añadiendo en la página:
 *   - <meta name="aprende-level" content="01-chats"> (sólo en páginas de nivel)
 *   - data-aprende-progress="bar" en el contenedor de la barra
 *   - data-aprende-progress="counter" en el texto del contador
 *   - data-aprende-card="01-chats" en cada card del índice
 */
(function () {
  const STORAGE_KEY = "autonomia.aprende.v1";
  const LEVELS = ["01-chats", "02-automatizaciones", "03-agentes", "04-orquestadores"];

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* localStorage may be disabled */
    }
  }

  function markCurrent() {
    const meta = document.querySelector('meta[name="aprende-level"]');
    if (!meta) return null;
    const slug = meta.content.trim();
    if (!LEVELS.includes(slug)) return slug;
    const state = readState();
    if (!state[slug]) {
      state[slug] = { opened: true, openedAt: new Date().toISOString() };
      writeState(state);
    }
    return slug;
  }

  function renderProgress() {
    const state = readState();
    const opened = LEVELS.filter((s) => state[s] && state[s].opened);
    const pct = Math.round((opened.length / LEVELS.length) * 100);

    const bar = document.querySelector('[data-aprende-progress="bar"]');
    if (bar) {
      bar.style.width = pct + "%";
      bar.setAttribute("aria-valuenow", String(pct));
    }
    const counter = document.querySelector('[data-aprende-progress="counter"]');
    if (counter) {
      counter.textContent =
        opened.length === 0
          ? "Aún no has abierto ningún nivel."
          : "Has abierto " + opened.length + " de " + LEVELS.length + " niveles.";
    }

    document.querySelectorAll("[data-aprende-card]").forEach((card) => {
      const slug = card.getAttribute("data-aprende-card");
      if (state[slug] && state[slug].opened) {
        card.classList.add("level-card--done");
        const status = card.querySelector("[data-aprende-status]");
        if (status) status.textContent = "Visitado";
      } else {
        card.classList.remove("level-card--done");
        const status = card.querySelector("[data-aprende-status]");
        if (status) status.textContent = "Pendiente";
      }
    });
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    markCurrent();
    renderProgress();
  });
})();
