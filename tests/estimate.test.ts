import { describe, expect, it, vi } from "vitest";
import type { ChatCompletion } from "openai/resources/chat/completions";
import type { ChatClient } from "@/assistant/client";
import { EstimateError, extractJson, runEstimate } from "@/assistant/estimate";

const ctx = { today: "2026-09-16", timezone: "UTC", currency: "INR" };

function reply(content: string): ChatCompletion {
  return {
    id: "c",
    object: "chat.completion",
    created: 0,
    model: "test",
    choices: [{ index: 0, finish_reason: "stop", logprobs: null, message: { role: "assistant", content, refusal: null } }],
  };
}

function client(...contents: string[]) {
  const calls: unknown[] = [];
  const fake: ChatClient = {
    complete: vi.fn(async (params) => {
      calls.push(params);
      const next = contents.shift();
      if (next === undefined) throw new Error("no more scripted replies");
      return reply(next);
    }),
  };
  return { fake, calls };
}

describe("extractJson", () => {
  it("tolerates fences and prose around the object", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('{"a":{"b":2}} trailing')).toEqual({ a: { b: 2 } });
    expect(() => extractJson("nothing here")).toThrow(EstimateError);
  });
});

describe("runEstimate", () => {
  it("validates food macros and returns them typed", async () => {
    const { fake, calls } = client(
      '{"calories":350,"proteinG":12,"carbsG":55,"fatG":9,"assumption":"1 bowl ≈ 250 g cooked oats with milk","confidence":"medium"}',
    );
    const result = await runEstimate("food_macros", { name: "oats", quantity: 1, unit: "bowl" }, ctx, fake, "m");
    expect(result).toMatchObject({ calories: 350, proteinG: 12, confidence: "medium" });
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(calls[0])).toContain("oats");
  });

  it("retries once when the reply is not valid, then gives up", async () => {
    const { fake, calls } = client("I think about 300 calories", '{"calories":"lots"}');
    await expect(
      runEstimate("food_macros", { name: "dosa", quantity: 2, unit: "pieces" }, ctx, fake, "m"),
    ).rejects.toBeInstanceOf(EstimateError);
    expect(calls).toHaveLength(2);
  });

  it("rejects an expense category outside the closed list", async () => {
    const { fake } = client('{"category":"groceries","reason":"food shop"}', '{"category":"food","reason":"food shop"}');
    const result = await runEstimate("expense_category", { label: "big bazaar" }, ctx, fake, "m");
    expect(result.category).toBe("food");
  });

  it("passes today's date so relative dates can be resolved", async () => {
    const { fake, calls } = client(
      '{"title":"Update resume","area":"career","priority":"high","dueDate":"2026-09-18","reason":"by Friday"}',
    );
    const result = await runEstimate("task_fields", { title: "update resume by friday!!" }, ctx, fake, "m");
    expect(result.dueDate).toBe("2026-09-18");
    expect(JSON.stringify(calls[0])).toContain("Today is 2026-09-16 (wed)");
  });

  it("rejects bad input before calling the model", async () => {
    const { fake, calls } = client();
    await expect(runEstimate("food_macros", { name: "" }, ctx, fake, "m")).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});
