// Contact form widget for the home page #contacto section.
// Pairs with the Cloudflare Worker endpoint /api/contact (see worker/src/contact-handlers.ts).
//
// API base resolution mirrors comments.js:
//   1. window.AUTONOMIA_API_BASE
//   2. <meta name="autonomia-api-base" content="...">
//   3. otherwise → submit is disabled with an explanation.
//
// Prefill: if the visitor filled the AI-maturity questionnaire (see
// site/cuestionario.html), we read its localStorage payload (`autonomia.quiz.v1`)
// and prefill `email` and `sector` so they don't retype.
(function () {
  "use strict";

  var QUIZ_STORAGE_KEY = "autonomia.quiz.v1";

  var PAQUETES = {
    "diagnostico-express": {
      label: "Diagnóstico express",
      anchor: "/servicios.html#diagnostico-express",
      messageLine: "Me interesa el paquete \"Diagnóstico express\" (2 semanas, desde 1.500 €).",
    },
    piloto: {
      label: "Piloto de automatización",
      anchor: "/servicios.html#piloto",
      messageLine:
        "Me interesa el paquete \"Piloto de automatización\" (4–6 semanas, desde 6.000 €).",
    },
    acompanamiento: {
      label: "Acompañamiento gobernado",
      anchor: "/servicios.html#acompanamiento",
      messageLine:
        "Me interesa el paquete \"Acompañamiento gobernado\" (mensual, desde 3.500 €/mes).",
    },
  };

  function readPaqueteParam() {
    try {
      var params = new URLSearchParams(window.location.search);
      var raw = (params.get("paquete") || "").toLowerCase();
      return Object.prototype.hasOwnProperty.call(PAQUETES, raw) ? raw : null;
    } catch (e) {
      return null;
    }
  }

  function getApiBase() {
    if (typeof window.AUTONOMIA_API_BASE === "string" && window.AUTONOMIA_API_BASE) {
      return window.AUTONOMIA_API_BASE.replace(/\/$/, "");
    }
    var meta = document.querySelector('meta[name="autonomia-api-base"]');
    if (meta && meta.content) {
      var v = meta.content.replace(/\/$/, "");
      // Skip the placeholder URL ("example.workers.dev") so we degrade gracefully
      // until vars.AUTONOMIA_API_BASE is wired in production.
      if (v.indexOf("example.workers.dev") !== -1) return null;
      return v;
    }
    return null;
  }

  function setHint(form, html, tone) {
    var hint = form.querySelector("[data-contact-hint]");
    if (!hint) return;
    hint.hidden = false;
    hint.innerHTML = html;
    hint.dataset.tone = tone || "info";
  }

  function setupCounter(form) {
    var textarea = form.querySelector('textarea[name="message"]');
    var counter = form.querySelector("[data-contact-counter]");
    if (!textarea || !counter) return;
    var max = parseInt(textarea.getAttribute("maxlength") || "2000", 10);
    function update() {
      counter.textContent = textarea.value.length + " / " + max;
    }
    textarea.addEventListener("input", update);
    update();
  }

  function prefillFromQuiz(form) {
    var raw;
    try {
      raw = localStorage.getItem(QUIZ_STORAGE_KEY);
    } catch (e) {
      return;
    }
    if (!raw) return;
    var saved;
    try {
      saved = JSON.parse(raw);
    } catch (e) {
      return;
    }
    var data = saved && saved.data;
    if (!data || typeof data !== "object") return;

    var emailField = form.querySelector('input[name="email"]');
    if (emailField && !emailField.value && typeof data.open_email === "string") {
      emailField.value = data.open_email;
    }
    var sectorField = form.querySelector('select[name="sector"]');
    if (sectorField && !sectorField.value && typeof data.sector === "string") {
      var optionExists = Array.prototype.some.call(
        sectorField.options,
        function (opt) {
          return opt.value === data.sector;
        }
      );
      if (optionExists) sectorField.value = data.sector;
    }
    var sourceField = form.querySelector('input[name="source"]');
    if (sourceField) sourceField.value = "cuestionario";
  }

  function prefillFromPaquete(form, key) {
    var pkg = PAQUETES[key];
    if (!pkg) return;

    var hidden = form.querySelector("[data-contact-paquete-input]");
    if (hidden) hidden.value = key;

    var sourceField = form.querySelector('input[name="source"]');
    if (sourceField) sourceField.value = "servicios:" + key;

    var textarea = form.querySelector('textarea[name="message"]');
    if (textarea && !textarea.value) {
      textarea.value = pkg.messageLine + "\n\n";
      var counter = form.querySelector("[data-contact-counter]");
      if (counter) {
        var max = parseInt(textarea.getAttribute("maxlength") || "2000", 10);
        counter.textContent = textarea.value.length + " / " + max;
      }
    }

    var banner = document.querySelector("[data-contact-paquete]");
    if (banner) {
      banner.hidden = false;
      banner.innerHTML =
        "Vienes desde el paquete <strong>" +
        pkg.label +
        '</strong>. <a href="' +
        pkg.anchor +
        '">Ver detalles</a>.';
    }
  }

  function disableSubmit(form, reason) {
    var button = form.querySelector("[data-contact-submit]");
    if (button) {
      button.disabled = true;
      button.textContent = "Backend no conectado";
    }
    setHint(form, reason, "warn");
  }

  function init(form) {
    setupCounter(form);
    prefillFromQuiz(form);
    var paqueteKey = readPaqueteParam();
    if (paqueteKey) prefillFromPaquete(form, paqueteKey);

    var apiBase = getApiBase();
    if (!apiBase) {
      disableSubmit(
        form,
        "El formulario aún no está conectado al backend. Mientras tanto, escríbenos a <a href=\"mailto:hola@autonomia.local\">hola@autonomia.local</a>."
      );
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var button = form.querySelector("[data-contact-submit]");
      var data = new FormData(form);
      var payload = {
        name: (data.get("name") || "").toString().trim(),
        email: (data.get("email") || "").toString().trim(),
        sector: (data.get("sector") || "").toString().trim(),
        message: (data.get("message") || "").toString(),
        source: (data.get("source") || "home").toString(),
        paquete: (data.get("paquete") || "").toString().trim(),
        website: (data.get("website") || "").toString(),
      };

      if (!payload.name || !payload.email || !payload.message) {
        setHint(form, "Completa nombre, email y mensaje antes de enviar.", "warn");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        setHint(form, "Ese email no parece válido. Revísalo.", "warn");
        return;
      }

      var originalLabel = button.textContent;
      button.disabled = true;
      button.textContent = "Enviando…";
      setHint(form, "Enviando tu mensaje…", "info");

      fetch(apiBase + "/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              return { res: res, data: data };
            });
        })
        .then(function (r) {
          var res = r.res;
          var data = r.data || {};
          if (res.ok) {
            setHint(
              form,
              "<strong>¡Recibido!</strong> Te responderemos en menos de 24h. Revisa tu email; te hemos mandado una copia.",
              "ok"
            );
            button.textContent = "Mensaje enviado";
            Array.prototype.forEach.call(
              form.querySelectorAll("input,textarea,select"),
              function (f) {
                if (f.type !== "hidden") f.disabled = true;
              }
            );
          } else if (res.status === 429) {
            setHint(
              form,
              "Has enviado demasiados mensajes en la última hora. Inténtalo más tarde.",
              "warn"
            );
            button.disabled = false;
            button.textContent = originalLabel;
          } else if (res.status === 400) {
            setHint(form, "Revisa los datos: faltan campos o el email no es válido.", "warn");
            button.disabled = false;
            button.textContent = originalLabel;
          } else {
            setHint(
              form,
              "No hemos podido enviar tu mensaje (" +
                (data.error || res.status) +
                "). Inténtalo más tarde.",
              "error"
            );
            button.disabled = false;
            button.textContent = originalLabel;
          }
        })
        .catch(function () {
          setHint(form, "Error de red. Inténtalo más tarde.", "error");
          button.disabled = false;
          button.textContent = originalLabel;
        });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var forms = document.querySelectorAll("[data-contact-form]");
    Array.prototype.forEach.call(forms, init);
  });
})();
