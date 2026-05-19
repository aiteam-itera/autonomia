// First-party analytics event bus for AutonomIA.
// Sends beacons via navigator.sendBeacon to /api/track (Cloudflare Worker).
// Until the Worker is deployed, calls are silently no-op — the tracking code
// is wired now so no second pass is needed when the Worker ships.
//
// Usage: window.autonomia.track('event_name', { optional: 'props' })
//
// Cloudflare Web Analytics handles page_view automatically via the beacon
// snippet in each HTML <head>. Custom events (clicks, form submits, scroll
// depth) go through this module.
(function () {
  "use strict";

  function resolveEndpoint() {
    if (typeof window.AUTONOMIA_API_BASE === "string" && window.AUTONOMIA_API_BASE) {
      return window.AUTONOMIA_API_BASE.replace(/\/$/, "");
    }
    var meta = document.querySelector('meta[name="autonomia-api-base"]');
    return meta && meta.content ? meta.content.replace(/\/$/, "") : null;
  }

  function track(event, props) {
    var endpoint = resolveEndpoint();
    if (!endpoint) return;
    if (typeof navigator === "undefined" || !navigator.sendBeacon) return;
    try {
      navigator.sendBeacon(
        endpoint + "/api/track",
        JSON.stringify({ event: event, props: props || {}, url: location.href, ts: Date.now() })
      );
    } catch (e) {
      // tracking must never break the page
    }
  }

  // Fire scroll_depth_75 once per page load when the user reaches 75% of the page height.
  var scrollFired75 = false;
  function onScroll() {
    if (scrollFired75) return;
    var scrolled = window.scrollY + window.innerHeight;
    var total = document.documentElement.scrollHeight;
    if (total > 0 && scrolled / total >= 0.75) {
      scrollFired75 = true;
      track("scroll_depth_75", { page: location.pathname });
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  window.autonomia = window.autonomia || {};
  window.autonomia.track = track;
})();
