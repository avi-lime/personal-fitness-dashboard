import "server-only";
import { z } from "zod";
import type { McpContext } from "@/mcp/context";
import { toolByName } from "@/mcp/registry";
import { getToday } from "@/mcp/tools/read";
import { toLocalTime } from "@/lib/date";
import { type ChatClient } from "./client";
import { buildDigest } from "./digest";
import { extractJson, EstimateError } from "./estimate";

/**
 * A short, opinionated "here is what to do now" from the model, grounded in
 * today's snapshot. Suggestions may carry a ready-to-run action, restricted to
 * a whitelist of non-destructive tools and validated against their schemas.
 */
export const BRIEFING_ACTION_TOOLS = [
  "start_timer",
  "stop_timer",
  "complete_task",
  "complete_block",
  "plan_day",
  "log_water",
  "pay_bill",
  "add_task",
  "update_application",
] as const;

const rawBriefing = z.object({
  headline: z.string().min(1).max(160),
  suggestions: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        why: z.string().min(1).max(160),
        action: z
          .object({ tool: z.string(), args: z.record(z.string(), z.unknown()).default({}) })
          .nullable()
          .optional(),
      }),
    )
    .min(1)
    .max(6),
});

export interface BriefingSuggestion {
  title: string;
  why: string;
  action: { tool: string; args: Record<string, unknown>; label: string } | null;
}

export interface Briefing {
  date: string;
  generatedAt: string;
  headline: string;
  suggestions: BriefingSuggestion[];
}

function prompt(todayJson: string, digest: string, ctx: McpContext): string {
  return `You are the user's personal assistant. It is ${toLocalTime(new Date(), ctx.timezone)} on ${ctx.today} (${ctx.timezone}).
Below is today's state as JSON, then a digest of goals, tasks, plan, applications and money.
Tell the user exactly what to do next: one headline sentence, then 3 to 5 concrete suggestions in priority order — the overdue, the due, the block happening now, the goal furthest behind, the money item due. Be specific ("Pay the electricity bill (₹1,800, due Saturday)"), never generic ("stay hydrated").
A suggestion may include an action the app can run for them, using ONLY these tools: ${BRIEFING_ACTION_TOOLS.join(", ")}. Use ids/names from the data. Omit the action when nothing in the app should change (e.g. "go for the interview").
Return JSON only:
{"headline": string, "suggestions": [{"title": string, "why": string, "action": {"tool": string, "args": object} | null}]}

TODAY:
${todayJson}

DIGEST:
${digest}`;
}

export async function runBriefing(ctx: McpContext, client: ChatClient, model: string): Promise<Briefing> {
  const [today, digest] = await Promise.all([getToday(ctx), buildDigest(ctx)]);
  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: "You answer with a single JSON object and nothing else." },
    { role: "user", content: prompt(JSON.stringify(today), digest, ctx) },
  ];

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const completion = await client.complete({
      model,
      messages,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content ?? "";
    try {
      const parsed = rawBriefing.safeParse(extractJson(content));
      if (parsed.success) {
        return {
          date: ctx.today,
          generatedAt: new Date().toISOString(),
          headline: parsed.data.headline,
          suggestions: parsed.data.suggestions.map((suggestion) => ({
            title: suggestion.title,
            why: suggestion.why,
            action: validateAction(suggestion.action ?? null),
          })),
        };
      }
      lastError = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unparseable reply";
    }
    messages.push({ role: "user", content: `That was not valid. ${lastError}. Reply again with only the JSON object.` });
  }
  throw new EstimateError(`Could not build a briefing (${lastError}).`);
}

/** Keeps an action only if it names a whitelisted tool and its args validate. */
export function validateAction(
  action: { tool: string; args: Record<string, unknown> } | null,
): BriefingSuggestion["action"] {
  if (!action) return null;
  if (!(BRIEFING_ACTION_TOOLS as readonly string[]).includes(action.tool)) return null;
  const tool = toolByName.get(action.tool);
  if (!tool || tool.kind === "destructive") return null;
  const parsed = tool.input.safeParse(action.args);
  if (!parsed.success) return null;
  return { tool: tool.name, args: parsed.data as Record<string, unknown>, label: tool.title };
}
