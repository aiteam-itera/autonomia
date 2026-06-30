/* AutonomIA design-system v2 — scroll reveal (ITEA-3292).
   Opt-in: include this script + add data-reveal to elements.
   No-JS / no-observer / reduced-motion all degrade to fully visible. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;

  // Mark JS reveal active only now, so [data-reveal] starts hidden via CSS.
  root.classList.add("js-reveal");

  function bind() {
    var nodes = document.querySelectorAll("[data-reveal]:not(.is-in)");
    if (!nodes.length) return;
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
    );
    nodes.forEach(function (n) {
      io.observe(n);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
