import { handleConfirm, handleSubmit } from "./handlers";
import { handleCommentConfirm, handleCommentSubmit, type CommentEnv } from "./comment-handlers";

export default {
  async fetch(request: Request, env: CommentEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/submit") {
      return handleSubmit(request, env);
    }
    if (url.pathname === "/api/confirm") {
      return handleConfirm(request, env);
    }
    if (url.pathname === "/api/comment") {
      return handleCommentSubmit(request, env);
    }
    if (url.pathname === "/api/comment/confirm") {
      return handleCommentConfirm(request, env);
    }
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true, service: "autonomia-api" }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
};
