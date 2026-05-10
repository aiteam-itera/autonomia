import type { Env } from "./types";
import type { PendingComment } from "./comment-types";

const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24h
const MOD_QUEUE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const REJECT_LOG_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days
const RATE_LIMIT_TTL_SECONDS = 60 * 60; // 1h
const COMMENTS_PER_IP_PER_HOUR = 5;
const COMMENTS_PER_EMAIL_PER_HOUR = 2;

export async function saveCommentToken(
  env: Env,
  token: string,
  record: PendingComment,
): Promise<void> {
  await env.AUTONOMIA_KV.put(`comments/tokens/${token}`, JSON.stringify(record), {
    expirationTtl: TOKEN_TTL_SECONDS,
  });
}

export async function readCommentToken(
  env: Env,
  token: string,
): Promise<PendingComment | null> {
  const raw = await env.AUTONOMIA_KV.get(`comments/tokens/${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingComment;
  } catch {
    return null;
  }
}

export async function markCommentVerified(
  env: Env,
  token: string,
  record: PendingComment,
): Promise<void> {
  const updated: PendingComment = { ...record, status: "verified" };
  // Keep the verified record around briefly so a second click shows a friendly
  // "ya confirmado" page instead of a 404.
  await env.AUTONOMIA_KV.put(`comments/tokens/${token}`, JSON.stringify(updated), {
    expirationTtl: 60 * 30,
  });
}

export async function queueForModeration(
  env: Env,
  record: PendingComment,
): Promise<void> {
  const id = crypto.randomUUID();
  await env.AUTONOMIA_KV.put(
    `comments/moderation/${id}`,
    JSON.stringify(record),
    { expirationTtl: MOD_QUEUE_TTL_SECONDS },
  );
}

export async function logHardReject(
  env: Env,
  record: PendingComment,
): Promise<void> {
  const key = `comments/rejected/${new Date().toISOString()}/${crypto.randomUUID()}`;
  await env.AUTONOMIA_KV.put(key, JSON.stringify(record), {
    expirationTtl: REJECT_LOG_TTL_SECONDS,
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

export async function checkCommentRateLimit(
  env: Env,
  ip: string,
  email: string,
): Promise<RateLimitResult> {
  const ipResult = await bumpCounter(env, `rl/comments/ip/${ip}`, COMMENTS_PER_IP_PER_HOUR);
  if (!ipResult.ok) return ipResult;
  return bumpCounter(env, `rl/comments/email/${email.toLowerCase()}`, COMMENTS_PER_EMAIL_PER_HOUR);
}
