import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import type { ChatClient } from "@/assistant/client";
import {
  NOT_UNDERSTOOD_REPLY,
  RATE_LIMITED_REPLY,
  runAssistant,
} from "@/assistant/runner";
import { defineTool } from "@/mcp/registry";
import { ToolFailure } from "@/mcp/tools/write";
import type { McpContext } from "@/mcp/context";

/** No database here: the tools are in-memory fakes and the model is scripted. */

const ctx: McpContext = { userId: "u1", timezone: "UTC", today: "2026-09-16", source: "assistant" };

type Scripted = { content?: string; calls?: Array<{ name: string; args: string }> };

function completion(script: Scripted): ChatCompletion {
  return {
    id: "c",
    object: "chat.completion",
    created: 0,
    model: "test",
    choices: [
      {
        index: 0,
        finish_reason: script.calls ? "tool_calls" : "stop",
        logprobs: null,
        message: {
          role: "assistant",
          content: script.content ?? null,
          refusal: null,
          tool_calls: script.calls?.map((call, index) => ({
            id: `call_${index}`,
            type: "function" as const,
            function: { name: call.name, arguments: call.args },
          })),
        },
      },
    ],
  };
}

function scriptedClient(...scripts: Array<Scripted | Error>) {
  const requests: ChatCompletionCreateParamsNonStreaming[] = [];
  const client: ChatClient = {
    complete: vi.fn(async (params) => {
      requests.push(params);
      const next = scripts.shift();
      if (!next) throw new Error("Unexpected extra model call");
      if (next instanceof Error) throw next;
      return completion(next);
    }),
  };
  return { client, requests };
}

const logWater = vi.fn(async (_ctx: McpContext, args: { milliliters: number }) => ({
  summary: `Logged ${args.milliliters} ml of water.`,
  data: { milliliters: args.milliliters },
}));
const getToday = vi.fn(async () => ({ summary: "3/5 goals complete.", data: { done: 3 } }));
const removeGoal = vi.fn(async () => ({ summary: "Archived.", data: {} }));

const tools = [
  defineTool({
    name: "log_water",
    title: "Log water",
    description: "Records water.",
    kind: "write",
    input: z.object({ milliliters: z.number().int().min(1).max(10_000) }),
    run: logWater,
  }),
  defineTool({
    name: "get_today",
    title: "Get today",
    description: "Today's snapshot.",
    kind: "read",
    input: z.object({}),
    run: getToday,
  }),
  defineTool({
    name: "remove_goal",
    title: "Remove goal",
    description: "Archives a goal.",
    kind: "destructive",
    input: z.object({ goalId: z.string().uuid() }),
    run: removeGoal,
    describe: async (_ctx, args) => `Archive goal ${args.goalId}?`,
  }),
  defineTool({
    name: "fails",
    title: "Fails",
    description: "Always fails.",
    kind: "write",
    input: z.object({}),
    run: async () => {
      throw new ToolFailure("Nothing to do.");
    },
  }),
];

const base = { model: "test", tools, ctx, systemPrompt: "sys", history: [] };

describe("assistant runner", () => {
  it("answers a pure write from the tool summary with a single model call", async () => {
    logWater.mockClear();
    const { client, requests } = scriptedClient({
      calls: [{ name: "log_water", args: '{"milliliters":500}' }],
    });
    const response = await runAssistant({ ...base, client, input: "log 500 ml water" });
    expect(response).toEqual({
      reply: "Logged 500 ml of water.",
      actions: [{ tool: "log_water", summary: "Logged 500 ml of water." }],
      understood: true,
    });
    expect(logWater).toHaveBeenCalledTimes(1);
    expect(logWater.mock.calls[0][0]).toBe(ctx);
    expect(requests).toHaveLength(1);
    expect(requests[0].tool_choice).toBe("auto");
    expect(requests[0].tools).toHaveLength(tools.length);
  });

  it("loops once more after a read so the model can phrase the answer", async () => {
    const { client, requests } = scriptedClient(
      { calls: [{ name: "get_today", args: "{}" }] },
      { content: "You have finished three of five goals." },
    );
    const response = await runAssistant({ ...base, client, input: "how is my day" });
    expect(response.reply).toBe("You have finished three of five goals.");
    expect(response.actions).toEqual([]);
    expect(response.understood).toBe(true);
    expect(requests).toHaveLength(2);
    const toolMessage = requests[1].messages.find((m) => m.role === "tool");
    expect(toolMessage && "content" in toolMessage ? toolMessage.content : "").toContain(
      "3/5 goals complete.",
    );
  });

  it("never executes a destructive tool; it returns it as pending", async () => {
    removeGoal.mockClear();
    const id = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    const { client } = scriptedClient({
      calls: [{ name: "remove_goal", args: JSON.stringify({ goalId: id }) }],
    });
    const response = await runAssistant({ ...base, client, input: "archive the water goal" });
    expect(removeGoal).not.toHaveBeenCalled();
    expect(response.pending).toEqual({
      tool: "remove_goal",
      args: { goalId: id },
      summary: `Archive goal ${id}?`,
    });
    expect(response.reply).toBe(`Archive goal ${id}?`);
  });

  it("retries once with tool_choice=required after an empty response, then gives up honestly", async () => {
    const { client, requests } = scriptedClient({}, {});
    const response = await runAssistant({ ...base, client, input: "asdf" });
    expect(response).toEqual({ reply: NOT_UNDERSTOOD_REPLY, actions: [], understood: false });
    expect(requests).toHaveLength(2);
    expect(requests[1].tool_choice).toBe("required");
    expect(requests[1].messages.at(-1)?.role).toBe("system");
  });

  it("feeds validation errors back so the model can correct itself", async () => {
    logWater.mockClear();
    const { client, requests } = scriptedClient(
      { calls: [{ name: "log_water", args: '{"milliliters":-5}' }] },
      { calls: [{ name: "log_water", args: '{"milliliters":250}' }] },
    );
    const response = await runAssistant({ ...base, client, input: "water" });
    expect(logWater).toHaveBeenCalledTimes(1);
    expect(response.reply).toBe("Logged 250 ml of water.");
    const feedback = requests[1].messages.find((m) => m.role === "tool");
    expect(feedback && "content" in feedback ? feedback.content : "").toContain("invalid arguments");
  });

  it("treats malformed JSON and unknown tools as recoverable, within the round budget", async () => {
    const { client } = scriptedClient(
      { calls: [{ name: "nope", args: "{" }] },
      { content: "I cannot do that." },
    );
    const response = await runAssistant({ ...base, client, input: "???" });
    expect(response.reply).toBe("I cannot do that.");
  });

  it("surfaces a ToolFailure to the model instead of crashing", async () => {
    const { client } = scriptedClient(
      { calls: [{ name: "fails", args: "{}" }] },
      { content: "There was nothing to do." },
    );
    const response = await runAssistant({ ...base, client, input: "do the thing" });
    expect(response.reply).toBe("There was nothing to do.");
  });

  it("reports rate limiting without retrying", async () => {
    const error = Object.assign(new Error("Too Many Requests"), { status: 429 });
    const { client, requests } = scriptedClient(error);
    const response = await runAssistant({ ...base, client, input: "log water" });
    expect(response).toEqual({ reply: RATE_LIMITED_REPLY, actions: [], understood: false });
    expect(requests).toHaveLength(1);
  });

  it("stops at maxRounds and still reports what it did", async () => {
    const { client } = scriptedClient(
      { calls: [{ name: "get_today", args: "{}" }] },
      { calls: [{ name: "get_today", args: "{}" }] },
    );
    const response = await runAssistant({ ...base, client, input: "loop", maxRounds: 2 });
    expect(response.understood).toBe(false);
    expect(response.reply).toBe(NOT_UNDERSTOOD_REPLY);
  });
});
