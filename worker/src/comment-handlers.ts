import { validate } from "../../tools/comment-validator/src/index";
import {
  checkCommentRateLimit,
  logHardReject,
  markCommentVerified,
  queueForModeration,
  readCommentToken,
  saveCommentToken,
} from "./comment-storage";
import { sendCommentVerificationEmail } from "./comment-email";
import { createPaperclipIssueForComment } from "./paperclip";
import type { Env } from "./types";
import type { CommentSubmission, PendingComment } from "./comment-types";

// Worker env vars consumed only by the comment flow. Declared here to keep the
// shared `Env` interface focused on the recommendation engine.
export interface CommentEnv extends Env {
  PAPERCLIP_API_URL?: string;
  PAPERCLIP_API_KEY?: string;
  PAPERCLIP_COMPANY_ID?: string;
  PAPERCLIP_ASSIGNEE_AGENT_ID?: string;
  PAPERCLIP_PROJECT_ID?: string;
  PAPERCLIP_PARENT_ID?: string;
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function jsonError(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}
function jsonOk(message: string, extra: Record<string, unknown> = {}, status = 202): Response {
  return new Response(JSON.stringify({ ok: true, message, ...extra }), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function parseSubmission(body: unknown): CommentSubmission | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.name !== "string") return null;
  if (typeof b.email !== "string") return null;
  if (typeof b.comment !== "string") return null;
  if (typeof b.postSlug !== "string" || !b.postSlug) return null;
  if (typeof b.postTitle !== "string" || !b.postTitle) return null;
  return {
    name: b.name,
    email: b.email,
    comment: b.comment,
    postSlug: b.postSlug.slice(0, 200),
    postTitle: b.postTitle.slice(0, 200),
  };
}

export async function handleCommentSubmit(request: Request, env: CommentEnv): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== "POST") return jsonError(405, "method_not_allowed");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json");
  }
  const submission = parseSubmission(body);
  if (!submission) return jsonError(400, "invalid_payload");

  const ip = getClientIp(request);
  const validation = validate({
    name: submission.name,
    email: submission.email,
    comment: submission.comment,
  });

  // Hard reject: log and tell the user politely, but never reveal the rule id.
  if (validation.severity === "hard") {
    const rejected: PendingComment = {
      ...submission,
      status: "rejected_hard",
      validation,
      ip,
      createdAt: new Date().toISOString(),
    };
    await logHardReject(env, rejected);
    return jsonError(422, "comment_rejected", {
      message: "Tu comentario no cumple las reglas de moderación. Si crees que es un error, escríbenos.",
    });
  }

  // Soft reject: also stops here. We queue for human moderation but DO NOT
  // send a verification email — there is no point burning a Resend send on a
  // comment that will not be auto-published.
  if (validation.severity === "soft") {
    const queued: PendingComment = {
      ...submission,
      status: "rejected_soft",
      validation,
      ip,
      createdAt: new Date().toISOString(),
    };
    await queueForModeration(env, queued);
    return jsonOk(
      "Tu comentario ha quedado en moderación. Si pasa la revisión humana, lo verás publicado en unos días.",
      { moderation: true },
    );
  }

  // Safe: rate-limit, save pending token, send verification email.
  const rl = await checkCommentRateLimit(env, ip, submission.email);
  if (!rl.ok) return jsonError(429, "rate_limited", { retryAfterSeconds: rl.retryAfterSeconds });

  const token = crypto.randomUUID();
  const pending: PendingComment = {
    ...submission,
    status: "pending_email",
    validation,
    ip,
    createdAt: new Date().toISOString(),
  };
  await saveCommentToken(env, token, pending);

  try {
    await sendCommentVerificationEmail(env, submission.email, submission.postTitle, token);
  } catch (err) {
    console.error("send_comment_verification_failed", err);
    return jsonError(500, "email_send_failed");
  }
  return jsonOk("Te hemos enviado un email para verificar la dirección. Pulsa el enlace para que tu comentario llegue a moderación.");
}

export async function handleCommentConfirm(request: Request, env: CommentEnv): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return htmlInvalid();

  const record = await readCommentToken(env, token);
  if (!record) return htmlInvalid();
  if (record.status === "verified") return htmlAlreadyConfirmed();
  if (record.status !== "pending_email") return htmlInvalid();

  // Mark verified IMMEDIATELY so a double-click doesn't double-create the issue.
  await markCommentVerified(env, token, record);

  const issue = await createPaperclipIssueForComment(env, record);
  if (!issue.ok) {
    console.warn("paperclip_issue_not_created", issue.error);
    // We still confirm to the user — moderation will pick it up another way.
  }

  return htmlConfirmed();
}

// ---- mini HTML pages -----------------------------------------------------

function page(title: string, body: string, status = 200): Response {
  const html = `<!doctype html><html lang="es"><head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${title} · AutonomIA</title>
    <style>
      body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
      .card{max-width:520px;background:#1e293b;border-radius:16px;padding:32px;line-height:1.55}
      h1{margin-top:0;font-size:1.5rem}
      a{color:#a5b4fc}
      .muted{color:#94a3b8;font-size:14px;margin-top:24px}
    </style>
  </head><body><div class="card">${body}</div></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function htmlConfirmed(): Response {
  return page(
    "Comentario confirmado",
    `<h1>¡Gracias! Tu comentario está en moderación</h1>
     <p>Hemos verificado tu email correctamente. Tu comentario ha llegado a la cola de moderación de AutonomIA.</p>
     <p>Si pasa la revisión, aparecerá en el post en las próximas horas.</p>
     <p class="muted">— AutonomIA</p>`,
  );
}

function htmlAlreadyConfirmed(): Response {
  return page(
    "Ya confirmado",
    `<h1>Ya confirmaste este comentario</h1>
     <p>Por seguridad cada enlace de confirmación se puede usar una sola vez. Tu comentario ya está en la cola de moderación.</p>
     <p class="muted">— AutonomIA</p>`,
  );
}

function htmlInvalid(): Response {
  return page(
    "Enlace no válido",
    `<h1>Enlace no válido o caducado</h1>
     <p>El enlace puede haber caducado (caduca en 24h) o no existir. Vuelve al post y deja el comentario de nuevo.</p>
     <p class="muted">— AutonomIA</p>`,
    404,
  );
}
