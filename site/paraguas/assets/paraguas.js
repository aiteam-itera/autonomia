/* AutonomIA · paraguas — shared interactions (vanilla, no deps).
   - sticky nav state + mobile toggle
   - scroll-reveal via IntersectionObserver
   - animated count-up for [data-count]
   - real lead capture: posts to /_contact.php (same first-party collector
     the rest of the site uses via assets/contact.js). No fake setTimeout. */
(function () {
  "use strict";

  // ── Nav ──────────────────────────────────────────────
  var nav = document.querySelector(".nav");
  if (nav) {
    var onScroll = function () { nav.classList.toggle("scrolled", window.scrollY > 8); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    var toggle = nav.querySelector(".nav-toggle");
    var links = nav.querySelector(".nav-links");
    if (toggle && links) {
      toggle.addEventListener("click", function () {
        links.classList.toggle("open");
        toggle.setAttribute("aria-expanded", links.classList.contains("open") ? "true" : "false");
      });
      links.addEventListener("click", function (e) {
        if (e.target.tagName === "A") {
          links.classList.remove("open");
          toggle.setAttribute("aria-expanded", "false");
        }
      });
    }
  }

  // ── Scroll reveal ────────────────────────────────────
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // ── Count-up ─────────────────────────────────────────
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var suffix = el.getAttribute("data-suffix") || "";
    var prefix = el.getAttribute("data-prefix") || "";
    var dur = 1100, start = null;
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = prefix + (Number.isInteger(target) ? Math.round(val) : val.toFixed(1)) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var counters = document.querySelectorAll("[data-count]");
  if ("IntersectionObserver" in window && counters.length) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { animateCount(en.target); cio.unobserve(en.target); }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (el) { cio.observe(el); });
  }

  // ── Lead form → first-party collector ────────────────
  function setHint(form, msg, tone) {
    var h = form.querySelector("[data-hint]");
    if (!h) return;
    h.hidden = false; h.textContent = msg; h.setAttribute("data-tone", tone || "info");
  }
  var forms = document.querySelectorAll("[data-lead-form]");
  Array.prototype.forEach.call(forms, function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector("button[type=submit]");
      var fd = new FormData(form);
      var payload = {
        name: (fd.get("name") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        sector: (fd.get("sector") || "").toString().trim(),
        message: (fd.get("message") || "").toString().trim(),
        source: (fd.get("source") || "paraguas").toString(),
        website: (fd.get("website") || "").toString() // honeypot
      };
      if (!payload.name || !payload.email || !payload.message) {
        return setHint(form, "Completa nombre, email y mensaje antes de enviar.", "warn");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        return setHint(form, "Ese email no parece válido. Revísalo.", "warn");
      }
      var label = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
      setHint(form, "Enviando tu mensaje…", "info");
      fetch("/_contact.php", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (res.ok) {
          setHint(form, "¡Recibido! Te respondemos en menos de 24h. Te hemos mandado una copia por email.", "ok");
          if (btn) btn.textContent = "Mensaje enviado ✓";
          Array.prototype.forEach.call(form.querySelectorAll("input,select,textarea"), function (f) {
            if (f.type !== "hidden") f.disabled = true;
          });
        } else if (res.status === 429) {
          setHint(form, "Demasiados envíos en la última hora. Inténtalo más tarde.", "warn");
          if (btn) { btn.disabled = false; btn.textContent = label; }
        } else {
          setHint(form, "No hemos podido enviar tu mensaje. Inténtalo más tarde o escribe a hola@itera.es.", "error");
          if (btn) { btn.disabled = false; btn.textContent = label; }
        }
      }).catch(function () {
        setHint(form, "Error de red. Inténtalo más tarde o escribe a hola@itera.es.", "error");
        if (btn) { btn.disabled = false; btn.textContent = label; }
      });
    });
  });

  // ── Year ─────────────────────────────────────────────
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
