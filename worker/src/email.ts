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

export async function sendVerificationEmail(
  env: Env,
  to: string,
  token: string,
): Promise<void> {
  const link = `${env.PUBLIC_URL.replace(/\/$/, "")}/api/confirm?token=${encodeURIComponent(token)}`;
  const subject = "Confirma tu email · AutonomIA";
  const text = [
    "Hola,",
    "",
    "Has solicitado tu plan personalizado de adopción de IA en autonomia.",
    "Para enviártelo necesitamos confirmar que este email es tuyo. Pulsa este enlace:",
    "",
    link,
    "",
    "Si no fuiste tú, ignora este mensaje. El enlace caduca en 24 horas y los datos asociados",
    "se borran automáticamente.",
    "",
    "— AutonomIA",
  ].join("\n");
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    <h2>Confirma tu email</h2>
    <p>Has solicitado tu plan personalizado de adopción de IA en AutonomIA.</p>
    <p>Para enviártelo necesitamos confirmar que este email es tuyo:</p>
    <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Confirmar y recibir mi plan</a></p>
    <p style="color:#64748b;font-size:14px">Si no fuiste tú, ignora este mensaje. El enlace caduca en 24 horas y los datos asociados se borran automáticamente.</p>
    <p style="color:#64748b;font-size:14px">— AutonomIA</p>
  </body></html>`;

  await sendEmail(env, { to, subject, html, text });
}

export async function sendRecommendationEmail(
  env: Env,
  to: string,
  markdown: string,
): Promise<void> {
  const subject = "Tu plan AutonomIA · 30 / 60 / 90 días";
  const intro = "Aquí tienes el plan personalizado a partir de tus respuestas:";
  const footer =
    "— AutonomIA · Para darte de baja responde a este email con asunto BAJA.";
  const text = `${intro}\n\n${markdown}\n\n${footer}`;
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a;line-height:1.55">
    <p>${escapeHtml(intro)}</p>
    <div>${markdownToHtml(markdown)}</div>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
    <p style="color:#64748b;font-size:13px">${escapeHtml(footer)}</p>
  </body></html>`;

  await sendEmail(env, { to, subject, html, text });
}

// Tiny markdown → HTML for the LLM output. The prompt constrains the format to:
// `## ...`, `**...**`, blank-line paragraphs, plain text and bare URLs.
// We deliberately keep this small instead of pulling a full markdown lib.
function markdownToHtml(md: string): string {
  const escaped = escapeHtml(md);
  const blocks = escaped.split(/\n{2,}/).map((block) => {
    if (block.startsWith("## ")) {
      return `<h2 style="margin-top:24px">${block.slice(3).trim()}</h2>`;
    }
    const inline = block
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(
        /https?:\/\/[^\s)]+/g,
        (url) => `<a href="${url}">${url}</a>`,
      )
      .replace(/\n/g, "<br />");
    return `<p>${inline}</p>`;
  });
  return blocks.join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
