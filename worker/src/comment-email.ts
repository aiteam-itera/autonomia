import type { Env } from "./types";

interface ResendResponse {
  id?: string;
  message?: string;
}

async function sendEmail(
  env: Env,
  args: { to: string; subject: string; html: string; text: string },
): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`resend_error status=${response.status} body=${body.slice(0, 200)}`);
  }
  const data = (await response.json()) as ResendResponse;
  if (!data.id) throw new Error(`resend_no_id ${data.message ?? ""}`);
}

export async function sendCommentVerificationEmail(
  env: Env,
  to: string,
  postTitle: string,
  token: string,
): Promise<void> {
  const link = `${env.PUBLIC_URL.replace(/\/$/, "")}/api/comment/confirm?token=${encodeURIComponent(token)}`;
  const subject = "Confirma tu comentario · AutonomIA";
  const text = [
    "Hola,",
    "",
    `Has dejado un comentario en el post "${postTitle}" en AutonomIA.`,
    "Para publicarlo necesitamos confirmar que este email es tuyo. Pulsa este enlace:",
    "",
    link,
    "",
    "Si no fuiste tú, ignora este mensaje. El enlace caduca en 24 horas.",
    "Tu comentario pasará por una validación automática antes de publicarse.",
    "",
    "— AutonomIA",
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    <h2>Confirma tu comentario</h2>
    <p>Has dejado un comentario en el post <strong>${escapeHtml(postTitle)}</strong> en AutonomIA.</p>
    <p>Para publicarlo necesitamos confirmar que este email es tuyo:</p>
    <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Confirmar comentario</a></p>
    <p style="color:#64748b;font-size:14px">Si no fuiste tú, ignora este mensaje. El enlace caduca en 24 horas. Tu comentario pasará por una validación automática antes de publicarse.</p>
    <p style="color:#64748b;font-size:14px">— AutonomIA</p>
  </body></html>`;
  await sendEmail(env, { to, subject, html, text });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
