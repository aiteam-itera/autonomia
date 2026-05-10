import type { Env } from "./types";
import type { ContactRecord, ContactSubmission } from "./contact-types";

export interface ContactEnv extends Env {
  PAPERCLIP_API_URL?: string;
  PAPERCLIP_API_KEY?: string;
  PAPERCLIP_COMPANY_ID?: string;
  PAPERCLIP_ASSIGNEE_AGENT_ID?: string;
  PAPERCLIP_PROJECT_ID?: string;
  PAPERCLIP_LEAD_PARENT_ID?: string;
  PAPERCLIP_LEAD_ASSIGNEE_AGENT_ID?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX = 100;
const SECTOR_MAX = 80;
const MESSAGE_MAX = 2000;
const SOURCE_MAX = 40;
const PAQUETE_ALLOWED = new Set(["diagnostico-express", "piloto", "acompanamiento"]);
const ARCHIVE_TTL_SECONDS = 60 * 60 * 24 * 90;
const RATE_LIMIT_TTL_SECONDS = 60 * 60;
const LEADS_PER_IP_PER_HOUR = 5;
const LEADS_PER_EMAIL_PER_HOUR = 2;

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
function jsonOk(message: string, extra: Record<string, unknown> = {}, status = 200): Response {
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

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) return null;
  return trimmed;
}

export function parseSubmission(body: unknown): ContactSubmission | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const name = clean(b.name, NAME_MAX);
  if (!name) return null;
  const email = clean(b.email, 200);
  if (!email || !EMAIL_RE.test(email)) return null;
  const message = clean(b.message, MESSAGE_MAX);
  if (!message) return null;

  const sectorRaw = b.sector;
  const sector = typeof sectorRaw === "string" ? sectorRaw.trim().slice(0, SECTOR_MAX) : "";
  const sourceRaw = b.source;
  const source = typeof sourceRaw === "string" ? sourceRaw.trim().slice(0, SOURCE_MAX) : "";
  const paqueteRaw = b.paquete;
  const paqueteCandidate =
    typeof paqueteRaw === "string" ? paqueteRaw.trim().toLowerCase() : "";
  const paquete = PAQUETE_ALLOWED.has(paqueteCandidate) ? paqueteCandidate : "";
  const websiteRaw = b.website;
  const website = typeof websiteRaw === "string" ? websiteRaw : "";

  return {
    name,
    email,
    message,
    sector: sector || undefined,
    source: source || undefined,
    paquete: paquete || undefined,
    website,
  };
}

async function bumpCounter(env: Env, key: string, limit: number): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  const raw = await env.AUTONOMIA_KV.get(key);
  const current = raw ? Number.parseInt(raw, 10) || 0 : 0;
  if (current >= limit) {
    return { ok: false, retryAfterSeconds: RATE_LIMIT_TTL_SECONDS };
  }
  await env.AUTONOMIA_KV.put(key, String(current + 1), { expirationTtl: RATE_LIMIT_TTL_SECONDS });
  return { ok: true, retryAfterSeconds: 0 };
}

async function checkRateLimit(env: Env, ip: string, email: string) {
  const ipResult = await bumpCounter(env, `rl/contact/ip/${ip}`, LEADS_PER_IP_PER_HOUR);
  if (!ipResult.ok) return ipResult;
  return bumpCounter(env, `rl/contact/email/${email.toLowerCase()}`, LEADS_PER_EMAIL_PER_HOUR);
}

async function archiveLead(env: Env, record: ContactRecord): Promise<void> {
  const key = `contact/leads/${record.createdAt}/${record.email.toLowerCase()}`;
  await env.AUTONOMIA_KV.put(key, JSON.stringify(record), { expirationTtl: ARCHIVE_TTL_SECONDS });
}

interface CreateLeadIssueResult {
  ok: boolean;
  issueId?: string;
  error?: string;
}

async function createPaperclipLeadIssue(env: ContactEnv, record: ContactRecord): Promise<CreateLeadIssueResult> {
  const required = [env.PAPERCLIP_API_URL, env.PAPERCLIP_API_KEY, env.PAPERCLIP_COMPANY_ID];
  if (required.some((v) => !v)) {
    console.warn("paperclip_lead_integration_not_configured");
    return { ok: false, error: "not_configured" };
  }

  const sectorTag = record.sector ? record.sector : "sector sin especificar";
  const paqueteTag = record.paquete ? ` [${record.paquete}]` : "";
  const title = `Lead${paqueteTag}: ${record.name} (${sectorTag})`.slice(0, 200);

  const description = [
    "## Lead capturado en autonomia.itera.es",
    "",
    `**Nombre:** ${record.name}`,
    `**Email:** ${record.email}`,
    `**Sector:** ${record.sector ?? "—"}`,
    `**Paquete preseleccionado:** ${record.paquete ?? "—"}`,
    `**Origen del formulario:** ${record.source ?? "home"}`,
    `**Recibido:** ${record.createdAt}`,
    `**IP:** ${record.ip}`,
    "",
    "### Qué quiere automatizar",
    "",
    "```text",
    record.message,
    "```",
    "",
    "---",
    "_Creado automáticamente por el Worker tras pasar honeypot, validación y rate-limit. Responde al lead en menos de 24h._",
  ].join("\n");

  const assignee = env.PAPERCLIP_LEAD_ASSIGNEE_AGENT_ID || env.PAPERCLIP_ASSIGNEE_AGENT_ID;
  const payload: Record<string, unknown> = {
    title,
    description,
    priority: "high",
    status: "todo",
  };
  if (assignee) payload.assigneeAgentId = assignee;
  if (env.PAPERCLIP_PROJECT_ID) payload.projectId = env.PAPERCLIP_PROJECT_ID;
  if (env.PAPERCLIP_LEAD_PARENT_ID) payload.parentId = env.PAPERCLIP_LEAD_PARENT_ID;

  const url = `${env.PAPERCLIP_API_URL!.replace(/\/$/, "")}/api/companies/${env.PAPERCLIP_COMPANY_ID}/issues`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.PAPERCLIP_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.text();
      console.error("paperclip_create_lead_failed", response.status, body.slice(0, 300));
      return { ok: false, error: `http_${response.status}` };
    }
    const data = (await response.json()) as { id?: string };
    return { ok: true, issueId: data.id };
  } catch (err) {
    console.error("paperclip_create_lead_threw", err);
    return { ok: false, error: "fetch_failed" };
  }
}

async function sendLeadAcknowledgement(env: Env, record: ContactRecord): Promise<void> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    console.warn("lead_ack_email_skipped_no_resend");
    return;
  }
  const subject = "Hemos recibido tu mensaje · AutonomIA";
  const text = [
    `Hola ${record.name},`,
    "",
    "Gracias por escribirnos a AutonomIA. Hemos recibido tu mensaje:",
    "",
    record.message,
    "",
    "Te responderemos en menos de 24h con los siguientes pasos.",
    "",
    "— AutonomIA",
  ].join("\n");

  const safeMessage = record.message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
    <h2>Hemos recibido tu mensaje</h2>
    <p>Hola ${escapeHtml(record.name)},</p>
    <p>Gracias por escribirnos a AutonomIA. Esto es lo que nos has contado:</p>
    <blockquote style="border-left:3px solid #6366f1;padding:8px 16px;color:#334155;margin:16px 0">${safeMessage}</blockquote>
    <p>Te responderemos en menos de 24h con los siguientes pasos.</p>
    <p style="color:#64748b;font-size:13px">— AutonomIA</p>
  </body></html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [record.email],
      subject,
      html,
      text,
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`resend_error status=${response.status} body=${body.slice(0, 200)}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function handleContactSubmit(request: Request, env: ContactEnv): Promise<Response> {
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

  // Honeypot: any non-empty `website` field means a bot. Pretend success so
  // the bot doesn't retune and move on.
  if (submission.website && submission.website.trim() !== "") {
    console.info("contact_honeypot_triggered");
    return jsonOk("Gracias, hemos recibido tu mensaje.");
  }

  const ip = getClientIp(request);
  const rl = await checkRateLimit(env, ip, submission.email);
  if (!rl.ok) return jsonError(429, "rate_limited", { retryAfterSeconds: rl.retryAfterSeconds });

  const record: ContactRecord = {
    ...submission,
    website: undefined,
    ip,
    createdAt: new Date().toISOString(),
  };

  await archiveLead(env, record);
  const issue = await createPaperclipLeadIssue(env, record);
  if (!issue.ok) {
    console.warn("paperclip_lead_issue_not_created", issue.error);
    // Still try to acknowledge — a lost ack is worse than a missing ticket.
  }

  try {
    await sendLeadAcknowledgement(env, record);
  } catch (err) {
    console.error("contact_ack_failed", err);
    // Do not fail the request: the lead is archived and the issue (if config'd) was created.
  }

  return jsonOk("Gracias. Te responderemos en menos de 24h.");
}
