// DEPRECATED (ITEA-3110, 2026-06-23): the lead recommendation engine now runs
// in-house via `tools/leads/` — the IronBrain agent IS the LLM during its
// heartbeat (no external Anthropic key, no Cloudflare Worker, no Resend), per
// the ITEA-2788 first-party / no-SPOF mandate. This Worker lead path
// (handleSubmit/handleConfirm) is NOT wired to production: cuestionario.html
// ships a placeholder `autonomia-api-base` meta and POSTs to first-party
// `_submit.php`. Kept for history; do not extend. Canonical pipeline:
// docs/LEAD_RECOMMENDATION_PIPELINE.md. The Worker's /api/contact, /api/comment
// and /api/track handlers are NOT deprecated and remain in service.
import {
  archiveResponse,
  bumpDailyLLMCounter,
  checkRateLimit,
  markTokenUsed,
  readToken,
  savePendingToken,
} from "./storage";
import { sendRecommendationEmail, sendVerificationEmail } from "./email";
import { callClaude } from "./llm";
import { buildPrompt } from "./prompt";
import { htmlAlreadyUsed, htmlConfirmed, htmlInvalid } from "./html";
import type { Env, SubmitPayload } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REQUIRED_OPEN_FIELDS = ["open_repetitivo", "open_freno", "open_objetivo"] as const;

function jsonError(status: number, error: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

function jsonOk(message: string, status = 202): Response {
  return new Response(JSON.stringify({ ok: true, message }), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function parsePayload(body: unknown): SubmitPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.email !== "string" || !EMAIL_RE.test(b.email)) return null;
  if (typeof b.level !== "string") return null;
  if (!b.score || typeof b.score !== "object") return null;
  const score = b.score as Record<string, unknown>;
  if (typeof score.overall !== "number" || !score.dims || typeof score.dims !== "object") return null;
  if (!b.answers || typeof b.answers !== "object") return null;
  const answers = b.answers as Record<string, unknown>;
  for (const field of REQUIRED_OPEN_FIELDS) {
    if (typeof answers[field] !== "string" || !(answers[field] as string).trim()) return null;
  }
  // Coerce all answer values to strings (radio inputs come as strings already).
  const normalizedAnswers: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === "string") normalizedAnswers[k] = v;
    else if (typeof v === "number") normalizedAnswers[k] = String(v);
  }
  return {
    email: b.email,
    level: b.level,
    score: {
      overall: score.overall,
      dims: score.dims as Record<string, number>,
    },
    answers: normalizedAnswers as SubmitPayload["answers"],
  };
}

export async function handleSubmit(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST,OPTIONS",
        "access-control-allow-headers": "content-type",
        "access-control-max-age": "86400",
      },
    });
  }
  if (request.method !== "POST") return jsonError(405, "method_not_allowed");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "invalid_json");
  }
  const payload = parsePayload(body);
  if (!payload) return jsonError(400, "invalid_payload");

  const ip = getClientIp(request);
  const rl = await checkRateLimit(env, ip, payload.email);
  if (!rl.ok) return jsonError(429, "rate_limited", { retryAfterSeconds: rl.retryAfterSeconds });

  const token = crypto.randomUUID();
  await savePendingToken(env, token, payload, ip);

  try {
    await sendVerificationEmail(env, payload.email, token);
  } catch (err) {
    console.error("send_verification_failed", err);
    return jsonError(500, "email_send_failed");
  }
  return jsonOk("Verifica tu email para recibir el plan.");
}

export async function handleConfirm(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return htmlInvalid();

  const record = await readToken(env, token);
  if (!record) return htmlInvalid();
  if (record.status === "used") return htmlAlreadyUsed();

  // Mark used immediately so a double-click doesn't double-send.
  await markTokenUsed(env, token, record);

  // Daily cost cap: count BEFORE calling LLM.
  const dailyLimit = Number.parseInt(env.DAILY_LLM_LIMIT, 10) || 200;
  const calls = await bumpDailyLLMCounter(env);
  if (calls > dailyLimit) {
    console.warn("daily_llm_limit_reached", { calls, dailyLimit });
    // Fall back to a deterministic plan so the user still gets something useful.
    await sendFallbackPlan(env, record);
    return htmlConfirmed();
  }

  try {
    const prompt = buildPrompt(record);
    const markdown = await callClaude(env, prompt);
    await sendRecommendationEmail(env, record.email, markdown);
    await archiveResponse(env, record.email, record);
  } catch (err) {
    console.error("recommendation_pipeline_failed", err);
    // Best-effort fallback: still send a basic plan so the user gets something.
    try {
      await sendFallbackPlan(env, record);
    } catch (fallbackErr) {
      console.error("fallback_send_failed", fallbackErr);
    }
  }
  return htmlConfirmed();
}

async function sendFallbackPlan(env: Env, record: SubmitPayload): Promise<void> {
  const md = `## Tu plan AutonomIA · 30 / 60 / 90 días

**En 30 días — quick win**
Elige una sola tarea repetitiva (la que escribiste como la que más tiempo te quita) y prueba a resolverla con un chat de IA empresarial durante una semana. Mide el tiempo antes y después.

**En 60 días — automatización guiada**
Si la prueba funcionó, automatiza ese flujo con una herramienta no-code (Make, n8n) y deja un humano validando los pasos críticos.

**En 90 días — gobernanza y métrica**
Documenta políticas básicas de uso de IA, define un responsable y mide horas ahorradas. Es el momento de plantear si introducir agentes con un orquestador.

**Recomendación**
Si todavía no tienes los procesos documentados, empieza por https://ficha.es. Si ya estáis listos para gobernanza y agentes en serio, mira https://ironclip.com.`;
  await sendRecommendationEmail(env, record.email, md);
}
