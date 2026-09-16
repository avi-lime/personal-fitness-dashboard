import "server-only";
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources/chat/completions";
import type { McpContext } from "@/mcp/context";
import { type AnyTool, toOpenAiTools } from "@/mcp/registry";
import { ToolFailure } from "@/mcp/tools/write";
import { formatZodError } from "@/lib/validation";
import { isRateLimitError, type ChatClient } from "./client";
import { STRICT_RETRY_INSTRUCTION } from "./prompt";
import type { AssistantAction, AssistantResponse, AssistantTurn, PendingAction } from "./types";

export interface RunAssistantOptions {
  client: ChatClient;
  model: string;
  tools: readonly AnyTool[];
  ctx: McpContext;
  systemPrompt: string;
  history: AssistantTurn[];
  input: string;
  /** Model calls allowed for one request. Free tiers are per-minute, so keep it low. */
  maxRounds?: number;
}

export const NOT_UNDERSTOOD_REPLY = "Sorry, I couldn't work out what to do with that.";
export const RATE_LIMITED_REPLY =
  "The assistant is rate-limited right now — try again in a minute.";

function isFunctionCall(
  call: ChatCompletionMessageToolCall,
): call is Extract<ChatCompletionMessageToolCall, { type: "function" }> {
  return call.type === "function";
}

/**
 * One user request → tool calls → one spoken reply.
 *
 * Design rules (see plan):
 * - A request that only *writes* gets its reply from the tool summaries, with
 *   no second model call. "Log 500 ml water" costs exactly one request.
 * - A request that *reads* loops once more so the model can phrase the answer.
 * - A destructive tool is never executed here; it comes back as `pending`.
 * - A malformed response earns one stricter retry, then an honest failure.
 */
export async function runAssistant(options: RunAssistantOptions): Promise<AssistantResponse> {
  const { client, model, tools, ctx, systemPrompt, history, input } = options;
  const maxRounds = options.maxRounds ?? 4;
  const declarations = toOpenAiTools(tools);
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: "user", content: input },
  ];

  const actions: AssistantAction[] = [];
  let strictRetryUsed = false;

  for (let round = 0; round < maxRounds; round += 1) {
    let completion;
    try {
      completion = await client.complete({
        model,
        messages,
        tools: declarations,
        tool_choice: strictRetryUsed ? "required" : "auto",
        temperature: 0.1,
      });
    } catch (error) {
      if (isRateLimitError(error)) return { reply: RATE_LIMITED_REPLY, actions, understood: false };
      throw error;
    }

    const message = completion.choices[0]?.message;
    const toolCalls = (message?.tool_calls ?? []).filter(isFunctionCall);
    const content = message?.content?.trim() ?? "";

    if (toolCalls.length === 0) {
      if (content) return { reply: content, actions, understood: true };
      if (strictRetryUsed) return { reply: NOT_UNDERSTOOD_REPLY, actions, understood: false };
      strictRetryUsed = true;
      messages.push({ role: "system", content: STRICT_RETRY_INSTRUCTION });
      continue;
    }

    messages.push({
      role: "assistant",
      content: message?.content ?? null,
      tool_calls: toolCalls,
    });

    let readRan = false;
    let invalidCall = false;

    for (const call of toolCalls) {
      const tool = byName.get(call.function.name);
      const parsedArgs = parseArguments(call.function.arguments);

      if (!tool || parsedArgs === null) {
        invalidCall = true;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: tool
            ? "Error: arguments were not valid JSON."
            : `Error: there is no tool named ${call.function.name}.`,
        });
        continue;
      }

      const validated = tool.input.safeParse(parsedArgs);
      if (!validated.success) {
        invalidCall = true;
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: `Error: invalid arguments — ${formatZodError(validated.error)}`,
        });
        continue;
      }

      if (tool.kind === "destructive") {
        const pending: PendingAction = {
          tool: tool.name,
          args: validated.data as Record<string, unknown>,
          summary: tool.describe
            ? await tool.describe(ctx, validated.data)
            : `${tool.title}: ${JSON.stringify(validated.data)}`,
        };
        return {
          reply: actions.length > 0 ? summaries(actions) : pending.summary,
          actions,
          pending,
          understood: true,
        };
      }

      try {
        const result = await tool.run(ctx, validated.data);
        if (tool.kind === "read") readRan = true;
        else actions.push({ tool: tool.name, summary: result.summary });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: `${result.summary}\n${JSON.stringify(result.data)}`,
        });
      } catch (error) {
        if (!(error instanceof ToolFailure)) throw error;
        invalidCall = true;
        messages.push({ role: "tool", tool_call_id: call.id, content: `Error: ${error.message}` });
      }
    }

    // Pure writes: the summaries are the answer. Save the round trip.
    if (!readRan && !invalidCall && actions.length > 0) {
      return { reply: summaries(actions), actions, understood: true };
    }
    // Otherwise let the model phrase the answer (or fix its mistake).
  }

  return {
    reply: actions.length > 0 ? summaries(actions) : NOT_UNDERSTOOD_REPLY,
    actions,
    understood: actions.length > 0,
  };
}

function parseArguments(raw: string): Record<string, unknown> | null {
  if (raw.trim() === "") return {};
  try {
    const value: unknown = JSON.parse(raw);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function summaries(actions: AssistantAction[]): string {
  return actions.map((action) => action.summary).join(" ");
}
