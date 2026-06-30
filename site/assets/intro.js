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

  // Progress bar — injected via JS so no-JS never sees it.
  const progressEl = document.createElement("div");
  progressEl.className = "intro__progress";
  progressEl.setAttribute("aria-hidden", "true");
  overlay.appendChild(progressEl);

  function setProgress(pct) {
    overlay.style.setProperty("--intro-p", pct + "%");
  }

  const message =
    "Crea una página web con tutoriales y mejores prácticas del uso de IA en PYMES, con un cuestionario de madurez y un blog.";

  // Visual reproduction of the real agent flow:
  //   tool calls → git commit → push → GitHub Actions deploy → IONOS sync → Playwright validate.
  const codeLines = [
    { html: '<span class="tok-mute">› planificando…</span>', delay: 70 },
    { html: '<span class="tok-tool">tool</span> <span class="tok-key">Edit</span>(<span class="tok-str">"site/index.html"</span>)', delay: 80 },
    { html: '<span class="tok-tool">tool</span> <span class="tok-key">Write</span>(<span class="tok-str">"site/cuestionario.html"</span>)', delay: 80 },
    { html: '<span class="tok-tool">tool</span> <span class="tok-key">Write</span>(<span class="tok-str">"site/blog/que-puede-hacer-la-ia-en-mi-pyme.html"</span>)', delay: 80 },
    { html: '<span class="tok-prompt">$</span> git commit -m <span class="tok-str">"feat(site): home + cuestionario + blog"</span>', delay: 90 },
    { html: '<span class="tok-prompt">$</span> git push origin main', delay: 90 },
    { html: '<span class="tok-mute">› GitHub Actions › Deploy site to IONOS</span>', delay: 100 },
    { html: '<span class="tok-ok">✓</span> lftp mirror site/ → ionos:/autonomia/', delay: 90 },
    { html: '<span class="tok-mute">› Playwright › screenshot + smoke check</span>', delay: 90 },
    { html: '<span class="tok-ok">✓ deployed</span> <span class="tok-str">https://ia.itera.es/</span>', delay: 80 },
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
      // Progress: 0 → 48% as message types
      setProgress(Math.round((i / message.length) * 48));
      const ch = message[i];
      // Slight cadence variation: pause longer on punctuation
      const base = 18 + Math.random() * 22;
      const punct = /[.,…]/.test(ch) ? 160 : /[\s]/.test(ch) ? 10 : 0;
      await delay(base + punct);
    }
    setProgress(50);
  }

  async function streamCode() {
    if (cancelled) return;
    overlay.dataset.introState = "code";
    codeNode.innerHTML = "";
    for (let i = 0; i < codeLines.length; i++) {
      if (cancelled) return;
      const line = codeLines[i];
      const lineEl = document.createElement("div");
      lineEl.innerHTML = line.html;
      codeNode.appendChild(lineEl);
      // Progress: 50 → 92% across code lines
      setProgress(50 + Math.round(((i + 1) / codeLines.length) * 42));
      await delay(line.delay);
    }
    setProgress(95);
  }

  function leave() {
    if (overlay.dataset.introState === "leaving") return;
    overlay.dataset.introState = "leaving";
    setProgress(100);
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
  // Safety net: never block the page longer than 10s even if something hangs
  const safetyTimer = setTimeout(leave, 10000);

  (async () => {
    await typeMessage();
    if (cancelled) return;
    await delay(280);
    await streamCode();
    if (cancelled) return;
    await delay(420);
    leave();
  })().finally(() => clearTimeout(safetyTimer));
})();
