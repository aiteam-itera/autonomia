import type { CommentEnv } from "./comment-handlers";
import type { PendingComment } from "./comment-types";

export interface CreateIssueResult {
  ok: boolean;
  issueId?: string;
  error?: string;
}

/**
 * Create a Paperclip issue for an accepted external comment.
 *
 * Configured via Worker secrets / vars:
 *   PAPERCLIP_API_URL     e.g. https://app.paperclip.ing
 *   PAPERCLIP_API_KEY     long-lived service key for the moderator agent
 *   PAPERCLIP_COMPANY_ID  AutonomIA company id
 *   PAPERCLIP_ASSIGNEE_AGENT_ID   CEO agent id (or moderator agent when one exists)
 *   PAPERCLIP_PROJECT_ID  AutonomIA project id (optional)
 *   PAPERCLIP_PARENT_ID   parent issue grouping all comment-derived tasks (optional)
 *
 * If any required var is missing, this is a no-op (returns ok:false). The
 * Worker still confirms the comment to the user — Paperclip integration is a
 * downstream concern, not a blocker.
 */
export async function createPaperclipIssueForComment(
  env: CommentEnv,
  record: PendingComment,
): Promise<CreateIssueResult> {
  const required = [env.PAPERCLIP_API_URL, env.PAPERCLIP_API_KEY, env.PAPERCLIP_COMPANY_ID];
  if (required.some((v) => !v)) {
    console.warn("paperclip_integration_not_configured");
    return { ok: false, error: "not_configured" };
  }

  const titleBody = record.comment.replace(/\s+/g, " ").trim().slice(0, 60);
  const title = `Comment on ${record.postSlug}: ${titleBody}`;

  const description = [
    `## External comment on \`${record.postSlug}\``,
    "",
    `**Post:** ${record.postTitle}`,
    `**Author:** ${record.name} <${record.email}>`,
    `**Submitted:** ${record.createdAt}`,
    `**Source IP:** ${record.ip}`,
    `**Validator:** ruleset ${record.validation.rulesetVersion} → ${record.validation.severity}`,
    "",
    "### Comment (verbatim)",
    "",
    "```text",
    record.comment,
    "```",
    "",
    "---",
    "_Created automatically by the AutonomIA Worker after email verification + safety validation. See `docs/COMMENT_VALIDATION.md`._",
  ].join("\n");

  const payload: Record<string, unknown> = {
    title,
    description,
    priority: "low",
    status: "todo",
    assigneeAgentId: env.PAPERCLIP_ASSIGNEE_AGENT_ID,
  };
  if (env.PAPERCLIP_PROJECT_ID) payload.projectId = env.PAPERCLIP_PROJECT_ID;
  if (env.PAPERCLIP_PARENT_ID) payload.parentId = env.PAPERCLIP_PARENT_ID;

  const url = `${env.PAPERCLIP_API_URL.replace(/\/$/, "")}/api/companies/${env.PAPERCLIP_COMPANY_ID}/issues`;

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
      console.error("paperclip_create_issue_failed", response.status, body.slice(0, 300));
      return { ok: false, error: `http_${response.status}` };
    }
    const data = (await response.json()) as { id?: string };
    return { ok: true, issueId: data.id };
  } catch (err) {
    console.error("paperclip_create_issue_threw", err);
    return { ok: false, error: "fetch_failed" };
  }
}
