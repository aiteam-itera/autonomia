// Comment widget for AutonomIA blog posts.
// Pairs with the Cloudflare Worker endpoint /api/comment (see worker/src/comment-handlers.ts)
// and the validator in tools/comment-validator/.
//
// Activation: include this script (deferred) on any page that contains a
// <form data-comment-form> element. The form must have hidden inputs
// `postSlug` and `postTitle` and visible inputs `name`, `email`, `comment`.
//
// API base resolution mirrors cuestionario.html:
//   1. window.AUTONOMIA_API_BASE
//   2. <meta name="autonomia-api-base" content="...">
//   3. otherwise → degrade gracefully (form disabled with explanation).
(function () {
  "use strict";

  function getApiBase() {
    if (typeof window.AUTONOMIA_API_BASE === "string" && window.AUTONOMIA_API_BASE) {
      return window.AUTONOMIA_API_BASE.replace(/\/$/, "");
    }
    var meta = document.querySelector('meta[name="autonomia-api-base"]');
    if (meta && meta.content) return meta.content.replace(/\/$/, "");
    return null;
  }

  function setHint(form, html, tone) {
    var hint = form.querySelector("[data-hint]");
    if (!hint) return;
    hint.hidden = false;
    hint.innerHTML = html;
    hint.dataset.tone = tone || "info";
  }

  function setupCounter(form) {
    var textarea = form.querySelector('textarea[name="comment"]');
    var counter = form.querySelector("[data-counter]");
    if (!textarea || !counter) return;
    var max = parseInt(textarea.getAttribute("maxlength") || "1500", 10);
    function update() {
      counter.textContent = textarea.value.length + " / " + max;
    }
    textarea.addEventListener("input", update);
    update();
  }

  function disableForm(form, reason) {
    var fields = form.querySelectorAll("input,textarea,button");
    Array.prototype.forEach.call(fields, function (f) { f.disabled = true; });
    setHint(form, reason, "warn");
  }

  function init(form) {
    setupCounter(form);
    var apiBase = getApiBase();
    if (!apiBase) {
      // We could keep the form interactive in dev, but it's misleading to
      // pretend the comment was sent. Better to be honest.
      disableForm(
        form,
        "Los comentarios no están conectados todavía en este entorno. Vuelve cuando el backend esté online.",
      );
      return;
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var button = form.querySelector("[data-submit]");
      var data = new FormData(form);
      var payload = {
        name: (data.get("name") || "").toString().trim(),
        email: (data.get("email") || "").toString().trim(),
        comment: (data.get("comment") || "").toString(),
        postSlug: (data.get("postSlug") || "").toString(),
        postTitle: (data.get("postTitle") || "").toString(),
      };
      if (!payload.name || !payload.email || !payload.comment) {
        setHint(form, "Completa todos los campos antes de enviar.", "warn");
        return;
      }

      button.disabled = true;
      var originalLabel = button.textContent;
      button.textContent = "Enviando…";
      setHint(form, "Comprobando tu comentario y enviando email de verificación…", "info");

      fetch(apiBase + "/api/comment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; }); })
        .then(function (r) {
          var res = r.res;
          var data = r.data || {};
          if (res.ok) {
            setHint(
              form,
              "<strong>Casi listo.</strong> Te hemos enviado un email para verificar la dirección. Pulsa el enlace para que tu comentario llegue a moderación.",
              "ok",
            );
            button.textContent = "Email enviado";
            // Disable inputs so the user doesn't accidentally re-submit.
            Array.prototype.forEach.call(form.querySelectorAll("input,textarea"), function (f) {
              if (f.type !== "hidden") f.disabled = true;
            });
          } else if (res.status === 422) {
            setHint(
              form,
              data.message || "Tu comentario no cumple las reglas de moderación. Si crees que es un error, escríbenos.",
              "warn",
            );
            button.disabled = false;
            button.textContent = originalLabel;
          } else if (res.status === 429) {
            setHint(form, "Has comentado demasiadas veces en la última hora. Inténtalo más tarde.", "warn");
            button.disabled = false;
            button.textContent = originalLabel;
          } else {
            setHint(
              form,
              "No hemos podido enviar tu comentario (" + (data.error || res.status) + "). Inténtalo más tarde.",
              "error",
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
    var forms = document.querySelectorAll("[data-comment-form]");
    Array.prototype.forEach.call(forms, init);
  });
})();
