/* AutonomIA design-system v2 — scroll reveal (ITEA-3292, X4 motion).
   Opt-in: include this script + add data-reveal to elements.
   No-JS / no-observer / reduced-motion all degrade to fully visible.

   Stagger: add data-reveal-stagger on a parent element. reveal.js will
   assign --stagger-i (0, 1, 2…) as a CSS custom property on each
   child [data-reveal] element so CSS can stagger transition-delay.

   Direction: data-reveal-dir="left|right" on any [data-reveal]. CSS
   handles the actual translateX — this script does not need to know.
*/
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) return;

  // Mark JS reveal active only now, so [data-reveal] starts hidden via CSS.
  root.classList.add("js-reveal");

  function applyStagger() {
    document.querySelectorAll("[data-reveal-stagger]").forEach(function (parent) {
      var children = Array.from(parent.querySelectorAll("[data-reveal]"));
      children.forEach(function (child, i) {
        // Only set if not already assigned (allows manual override via inline style).
        if (!child.style.getPropertyValue("--stagger-i")) {
          child.style.setProperty("--stagger-i", i);
        }
      });
    });
  }

  function bind() {
    applyStagger();

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
      { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
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
