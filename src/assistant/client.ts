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
export const DEFAULT_ASSISTANT_MODEL = "gemini-3.6-flash";
/** Used when the primary model is rate-limited or overloaded; separate free-tier quota. */
export const DEFAULT_FALLBACK_MODEL = "gemini-3.1-flash-lite";

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

export function fallbackModel(): string | null {
  const env = getEnv();
  if (env.ASSISTANT_FALLBACK_MODEL === "") return null;
  return env.ASSISTANT_FALLBACK_MODEL ?? DEFAULT_FALLBACK_MODEL;
}

function statusOf(error: unknown): number | null {
  return typeof error === "object" && error !== null && "status" in error
    ? (error as { status: unknown }).status as number
    : null;
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
  const fallback = fallbackModel();
  return {
    async complete(params) {
      try {
        return await client.chat.completions.create(params);
      } catch (error) {
        // Free tiers have small per-model quotas: on 429/503, try the lite model once.
        const status = statusOf(error);
        if (fallback && fallback !== params.model && (status === 429 || status === 503)) {
          return client.chat.completions.create({ ...params, model: fallback });
        }
        throw error;
      }
    },
  };
}

/** Turns a provider error into something a person can act on. */
export function describeAssistantError(error: unknown): string {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? (error as { status: unknown }).status
      : null;
  if (status === 400 || status === 401 || status === 403) {
    return "The assistant's API key was rejected. Check ASSISTANT_API_KEY (and ASSISTANT_BASE_URL if you changed the provider).";
  }
  if (status === 404) {
    return `The model "${assistantModel()}" was not found at this provider. Check ASSISTANT_MODEL.`;
  }
  if (status === 429) return "The assistant is rate-limited right now — try again in a minute.";
  if (status === 503 || status === 502 || status === 504) {
    return "The model is busy right now (provider says high demand) — try again in a moment.";
  }
  return error instanceof Error && error.message ? error.message : "The assistant did not respond.";
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
