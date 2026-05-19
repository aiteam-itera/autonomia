// Privacy-first analytics event receiver for the AutonomIA first-party event bus.
// Accepts POST beacons from site/assets/analytics.js and logs them to
// Cloudflare Workers Tail (visible in CF dashboard → Workers → Logs).
// No persistent storage, no PII, no IP retention.
export async function handleTrack(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405 });
  }

  try {
    const raw = await request.text();
    const payload = JSON.parse(raw) as { event?: string; props?: unknown; url?: string; ts?: number };
    if (payload.event && typeof payload.event === "string") {
      console.log(
        JSON.stringify({
          t: "track",
          event: payload.event,
          props: payload.props ?? {},
          url: payload.url ?? "",
          ts: payload.ts ?? Date.now(),
        })
      );
    }
  } catch {
    // malformed beacon — accept and discard silently
  }

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://ia.itera.es",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}
