// DEPRECATED (ITEA-3110, 2026-06-23): external Anthropic API call for the lead
// recommendation. Superseded by the in-house path in `tools/leads/` where the
// IronBrain agent itself drafts the recommendation during its heartbeat — no
// external API key. Not wired to production. See docs/LEAD_RECOMMENDATION_PIPELINE.md.
import type { Env } from "./types";

interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

export async function callClaude(env: Env, prompt: string): Promise<string> {
  const maxTokens = Number.parseInt(env.LLM_MAX_TOKENS, 10);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      max_tokens: Number.isFinite(maxTokens) ? maxTokens : 800,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`anthropic_error status=${response.status} body=${body.slice(0, 200)}`);
  }

  const data = (await response.json()) as AnthropicResponse;
  const text = data.content
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("anthropic_empty_response");
  return text;
}
