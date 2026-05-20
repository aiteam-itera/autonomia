// First-party analytics event bus for AutonomIA.
// Sends beacons to the same-origin PHP collector at /_a.php — no third party,
// no cookies. page_view fires automatically on load; custom events (clicks,
// form submits, scroll depth) go through window.autonomia.track().
//
// Usage: window.autonomia.track('event_name', { optional: 'props' })
//
// The collector keeps only a daily-rotating salted visitor hash (no raw IP/UA),
// so the baseline KPIs are computable without any third-party analytics.
(function () {
  "use strict";

  // Same-origin first-party endpoint. Kept overridable for tests/staging.
  var ENDPOINT =
    (typeof window.AUTONOMIA_TRACK_ENDPOINT === "string" && window.AUTONOMIA_TRACK_ENDPOINT) ||
    "/_a.php";

  function track(event, props) {
    var body = JSON.stringify({ event: event, props: props || {}, url: location.href, ts: Date.now() });
    try {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, body);
        return;
      }
      // Fallback for browsers without sendBeacon.
      var xhr = new XMLHttpRequest();
      xhr.open("POST", ENDPOINT, true);
      xhr.setRequestHeader("Content-Type", "text/plain;charset=UTF-8");
      xhr.send(body);
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

  // Fire page_view once per load.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { track("page_view"); });
  } else {
    track("page_view");
  }
})();
