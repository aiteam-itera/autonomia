import type { ValidationResult } from "../../tools/comment-validator/src/index";

export interface CommentSubmission {
  name: string;
  email: string;
  comment: string;
  postSlug: string;
  postTitle: string;
}

export interface PendingComment extends CommentSubmission {
  status: "pending_email" | "verified" | "rejected_soft" | "rejected_hard";
  validation: ValidationResult;
  ip: string;
  createdAt: string;
  paperclipIssueId?: string;
}
