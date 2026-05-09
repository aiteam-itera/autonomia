import { handleConfirm, handleSubmit } from "./handlers";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/submit") {
      return handleSubmit(request, env);
    }
    if (url.pathname === "/api/confirm") {
      return handleConfirm(request, env);
    }
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true, service: "autonomia-api" }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
};
