import type { Env, PendingToken, SubmitPayload } from "./types";

const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24h
const RATE_LIMIT_TTL_SECONDS = 60 * 60; // 1h
const ARCHIVE_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

const RATE_LIMIT_IP = 3;
const RATE_LIMIT_EMAIL = 1;

export async function savePendingToken(
  env: Env,
  token: string,
  payload: SubmitPayload,
  ip: string,
): Promise<void> {
  const record: PendingToken = {
    ...payload,
    status: "pending",
    createdAt: new Date().toISOString(),
    ip,
  };
  await env.AUTONOMIA_KV.put(`tokens/${token}`, JSON.stringify(record), {
    expirationTtl: TOKEN_TTL_SECONDS,
  });
}

export async function readToken(env: Env, token: string): Promise<PendingToken | null> {
  const raw = await env.AUTONOMIA_KV.get(`tokens/${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingToken;
  } catch {
    return null;
  }
}

export async function markTokenUsed(env: Env, token: string, record: PendingToken): Promise<void> {
  const updated: PendingToken = { ...record, status: "used" };
  // keep it for a short cooldown so we can show "ya usaste este enlace" instead of 404
  await env.AUTONOMIA_KV.put(`tokens/${token}`, JSON.stringify(updated), {
    expirationTtl: 60 * 30, // 30 min
  });
}

export async function archiveResponse(
  env: Env,
  email: string,
  payload: SubmitPayload,
): Promise<void> {
  const key = `archive/${email.toLowerCase()}/${new Date().toISOString()}`;
  await env.AUTONOMIA_KV.put(key, JSON.stringify(payload), {
    expirationTtl: ARCHIVE_TTL_SECONDS,
  });
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

async function bumpCounter(
  env: Env,
  key: string,
  limit: number,
): Promise<RateLimitResult> {
  const raw = await env.AUTONOMIA_KV.get(key);
  const current = raw ? Number.parseInt(raw, 10) || 0 : 0;
  if (current >= limit) {
    return { ok: false, retryAfterSeconds: RATE_LIMIT_TTL_SECONDS };
  }
  await env.AUTONOMIA_KV.put(key, String(current + 1), {
    expirationTtl: RATE_LIMIT_TTL_SECONDS,
  });
  return { ok: true, retryAfterSeconds: 0 };
}

export async function checkRateLimit(
  env: Env,
  ip: string,
  email: string,
): Promise<RateLimitResult> {
  const ipResult = await bumpCounter(env, `rl/ip/${ip}`, RATE_LIMIT_IP);
  if (!ipResult.ok) return ipResult;
  const emailResult = await bumpCounter(env, `rl/email/${email.toLowerCase()}`, RATE_LIMIT_EMAIL);
  return emailResult;
}

export async function bumpDailyLLMCounter(env: Env): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `metrics/llm-calls/${day}`;
  const raw = await env.AUTONOMIA_KV.get(key);
  const current = raw ? Number.parseInt(raw, 10) || 0 : 0;
  const next = current + 1;
  await env.AUTONOMIA_KV.put(key, String(next), {
    expirationTtl: 60 * 60 * 24 * 7, // keep one week of metrics
  });
  return next;
}
