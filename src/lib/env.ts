import "server-only";
import { z } from "zod";

/**
 * Server-side environment. This module is never bundled into client code:
 * secrets stay on the server.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_USERNAME: z.string().min(1).default("owner"),
  AUTH_PASSWORD: z.string().min(8, "AUTH_PASSWORD must be at least 8 characters"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  /** Bearer token for the MCP endpoint. Absent = MCP endpoint disabled. */
  MCP_TOKEN: z.string().min(24, "MCP_TOKEN must be at least 24 characters").optional(),
  /** Key for the assistant's model provider. Absent = assistant disabled. */
  ASSISTANT_API_KEY: z.string().min(10).optional(),
  /** Any OpenAI-compatible chat endpoint; defaults to Gemini's. */
  ASSISTANT_BASE_URL: z.string().url().optional(),
  ASSISTANT_MODEL: z.string().min(1).optional(),
  /** Tried once when the primary model returns 429/503. Set to "" to disable. */
  ASSISTANT_FALLBACK_MODEL: z.string().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(
      `Invalid environment configuration:\n${issues}\n\nCopy .env.example to .env.local and fill it in.`,
    );
  }
  cached = parsed.data;
  return cached;
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
