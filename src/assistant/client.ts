import "server-only";
import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import { getEnv } from "@/lib/env";

/**
 * The one method the runner needs. Keeping it this narrow lets tests supply a
 * scripted fake and keeps the provider swappable: anything that speaks the
 * OpenAI chat-completions dialect (Gemini's compatibility endpoint, OmniRoute,
 * Groq, OpenAI itself) works by changing ASSISTANT_BASE_URL.
 */
export interface ChatClient {
  complete(params: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion>;
}

export const DEFAULT_ASSISTANT_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";
export const DEFAULT_ASSISTANT_MODEL = "gemini-3.8-flash";

export function isAssistantConfigured(): boolean {
  try {
    return Boolean(getEnv().ASSISTANT_API_KEY);
  } catch {
    return false;
  }
}

export function assistantModel(): string {
  return getEnv().ASSISTANT_MODEL ?? DEFAULT_ASSISTANT_MODEL;
}

/** Created per request, never at module load, so builds need no key. */
export function createAssistantClient(): ChatClient {
  const env = getEnv();
  const client = new OpenAI({
    apiKey: env.ASSISTANT_API_KEY ?? "missing",
    baseURL: env.ASSISTANT_BASE_URL ?? DEFAULT_ASSISTANT_BASE_URL,
    maxRetries: 1,
    timeout: 45_000,
  });
  return {
    complete: (params) => client.chat.completions.create(params),
  };
}

/** True for the provider's "slow down" response; surfaced, never retried in a loop. */
export function isRateLimitError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: unknown }).status === 429
  );
}
