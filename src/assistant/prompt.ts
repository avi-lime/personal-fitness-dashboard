import "server-only";
import { SERVER_INSTRUCTIONS } from "@/mcp/instructions";
import type { McpContext } from "@/mcp/context";
import { toLocalTime } from "@/lib/date";

const VOICE_ADDENDUM = `You are the voice assistant built into this dashboard. The user speaks or types one short request at a time.

How to behave:
- Act immediately for logging, creating and updating: call the tool, do not ask for permission first. Destructive tools (removing or archiving) are confirmed by the system after you call them — just call them.
- Use sensible defaults instead of asking: "now" for timestamps, today for dates, the obvious unit. Only ask a question when the request is genuinely ambiguous.
- Never invent numbers. If the user gives calories but not macros, log calories only.
- When the user refers to something by name (a goal, a task, an account), use the ids and names in the context digest below rather than guessing.
- Reply in one short spoken sentence. No markdown, no lists, no emoji.
- If the request is not something this dashboard can do, say so in one sentence.`;

export interface PromptContext {
  ctx: McpContext;
  currency: string;
  digest: string;
}

/** The system prompt: shared MCP instructions + voice rules + today's context. */
export function buildSystemPrompt({ ctx, currency, digest }: PromptContext): string {
  const now = new Date();
  return [
    SERVER_INSTRUCTIONS,
    "",
    VOICE_ADDENDUM,
    "",
    `Today is ${ctx.today} and the local time is ${toLocalTime(now, ctx.timezone)} (${ctx.timezone}). Currency: ${currency}.`,
    "",
    "Context digest:",
    digest,
  ].join("\n");
}

/** The stricter nudge used once when the model failed to produce a usable call. */
export const STRICT_RETRY_INSTRUCTION =
  "Your previous response was not usable. Respond by calling exactly one of the available tools with valid JSON arguments that match its schema, or reply in one sentence if no tool applies.";
