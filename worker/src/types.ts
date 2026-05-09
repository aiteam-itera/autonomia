export interface Env {
  AUTONOMIA_KV: KVNamespace;
  ANTHROPIC_API_KEY: string;
  RESEND_API_KEY: string;
  PUBLIC_URL: string;
  EMAIL_FROM: string;
  LLM_MODEL: string;
  LLM_MAX_TOKENS: string;
  DAILY_LLM_LIMIT: string;
}

export interface QuizScore {
  overall: number;
  dims: Record<string, number>;
}

export interface QuizAnswers {
  sector?: string;
  tamano?: string;
  open_repetitivo: string;
  open_freno: string;
  open_objetivo: string;
  [key: string]: string | undefined;
}

export interface SubmitPayload {
  email: string;
  answers: QuizAnswers;
  score: QuizScore;
  level: string;
}

export interface PendingToken extends SubmitPayload {
  status: "pending" | "used";
  createdAt: string;
  ip: string;
}
