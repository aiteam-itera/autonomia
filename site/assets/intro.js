/**
 * Intro animation for AutonomIA home.
 *
 * Three phases:
 *   1. A chatbot bubble types out a self-referential message.
 *   2. A code panel rapidly streams a few lines of "agent boot" output.
 *   3. The overlay fades out and reveals the page.
 *
 * Skipped automatically when:
 *   - User has prefers-reduced-motion: reduce
 *   - Intro was already played in this tab session (sessionStorage)
 *   - User clicks the "Saltar intro" button or hits Esc
 *   - URL contains ?skipIntro
 */
(function () {
  "use strict";

  const overlay = document.getElementById("intro-overlay");
  if (!overlay) return;

  const STORAGE_KEY = "autonomia.intro.seen";
  const skipQuery = new URLSearchParams(location.search).has("skipIntro");
  const reducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Skip when driven by automation so CI/Playwright screenshots capture the real page.
  const isBot = !!navigator.webdriver || /HeadlessChrome|bot|crawler|spider/i.test(navigator.userAgent);
  let alreadySeen = false;
  try {
    alreadySeen = sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch (_) {
    /* private mode etc. — fall through and play */
  }

  if (reducedMotion || alreadySeen || skipQuery || isBot) {
    return; // overlay stays hidden
  }

  const textNode = overlay.querySelector("[data-intro-text]");
  const codeNode = overlay.querySelector("[data-intro-code] code");
  const skipBtn = overlay.querySelector("[data-intro-skip]");

  const message =
    "Hola. Soy un agente. Voy a generarte ahora mismo una página web sobre cómo automatizar tu negocio con IA.";

  const codeLines = [
    { html: '<span class="tok-prompt">$</span> autonomia start --target home', delay: 60 },
    { html: '<span class="tok-mute">› cargando visión…</span>', delay: 70 },
    {
      html:
        '<span class="tok-key">render</span>(<span class="tok-str">"hero"</span>, <span class="tok-str">"qué hacemos"</span>, <span class="tok-str">"aprende"</span>, <span class="tok-str">"blog"</span>)',
      delay: 80,
    },
    { html: '<span class="tok-mute">› montando cuestionario de madurez…</span>', delay: 80 },
    { html: '<span class="tok-mute">› enlazando recomendaciones…</span>', delay: 70 },
    { html: '<span class="tok-ok">✓ listo</span>', delay: 60 },
  ];

  let cancelled = false;
  const timers = [];
  function delay(ms) {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        timers.splice(timers.indexOf(t), 1);
        resolve();
      }, ms);
      timers.push(t);
    });
  }
  function cancel() {
    cancelled = true;
    timers.splice(0).forEach(clearTimeout);
  }

  async function typeMessage() {
    overlay.dataset.introState = "chat";
    for (let i = 0; i < message.length && !cancelled; i++) {
      textNode.textContent = message.slice(0, i + 1);
      const ch = message[i];
      // Slight cadence variation: pause longer on punctuation
      const base = 26 + Math.random() * 28;
      const punct = /[.,…]/.test(ch) ? 220 : /[\s]/.test(ch) ? 14 : 0;
      await delay(base + punct);
    }
  }

  async function streamCode() {
    if (cancelled) return;
    overlay.dataset.introState = "code";
    codeNode.innerHTML = "";
    for (const line of codeLines) {
      if (cancelled) return;
      const lineEl = document.createElement("div");
      lineEl.innerHTML = line.html;
      codeNode.appendChild(lineEl);
      await delay(line.delay);
    }
  }

  function leave() {
    if (overlay.dataset.introState === "leaving") return;
    overlay.dataset.introState = "leaving";
    cancel();
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch (_) {
      /* ignore */
    }
    setTimeout(() => {
      overlay.hidden = true;
      document.body.classList.remove("intro-open");
    }, 650);
  }

  function onKey(e) {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      leave();
    }
  }

  // Show overlay (it's hidden by default so SEO/no-JS visitors see content immediately)
  overlay.hidden = false;
  document.body.classList.add("intro-open");
  skipBtn.addEventListener("click", leave);
  document.addEventListener("keydown", onKey);
  // Safety net: never block the page longer than 8s even if something hangs
  const safetyTimer = setTimeout(leave, 8000);

  (async () => {
    await typeMessage();
    if (cancelled) return;
    await delay(350);
    await streamCode();
    if (cancelled) return;
    await delay(450);
    leave();
  })().finally(() => clearTimeout(safetyTimer));
})();
