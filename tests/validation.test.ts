import { describe, expect, it } from "vitest";
import { goalInputSchema, goalUpdateSchema, taskInputSchema, timeEntryInputSchema } from "@/lib/validation";

const base = { name: "Study", type: "duration", period: "daily", targetValue: 1 };

describe("goal metric parameters", () => {
  it("requires a category for time tracked", () => {
    expect(goalInputSchema.safeParse({ ...base, metricKey: "time_minutes" }).success).toBe(false);
    expect(
      goalInputSchema.safeParse({ ...base, metricKey: "time_minutes", metricParam: "study" }).success,
    ).toBe(true);
    expect(
      goalInputSchema.safeParse({ ...base, metricKey: "time_minutes", metricParam: "gaming" }).success,
    ).toBe(false);
  });

  it("rejects a parameter on metrics that do not take one", () => {
    expect(goalInputSchema.safeParse({ ...base, metricKey: "protein", metricParam: "study" }).success).toBe(false);
    expect(goalInputSchema.safeParse({ ...base, metricParam: "study" }).success).toBe(false);
  });

  it("only checks a partial update when both fields are present", () => {
    expect(goalUpdateSchema.safeParse({ metricParam: "study" }).success).toBe(true);
    expect(goalUpdateSchema.safeParse({ metricKey: "protein", metricParam: "study" }).success).toBe(false);
  });
});

describe("tasks and time", () => {
  it("validates task input", () => {
    expect(taskInputSchema.parse({ title: "  Update resume " })).toMatchObject({
      title: "Update resume",
      priority: "medium",
    });
    expect(taskInputSchema.safeParse({ title: "x", dueDate: "2026-02-30" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ title: "x", area: "gym" }).success).toBe(false);
  });

  it("bounds a session length", () => {
    expect(timeEntryInputSchema.safeParse({ category: "study", minutes: 45 }).success).toBe(true);
    expect(timeEntryInputSchema.safeParse({ category: "study", minutes: 0 }).success).toBe(false);
    expect(timeEntryInputSchema.safeParse({ category: "study", minutes: 30.5 }).success).toBe(false);
    expect(timeEntryInputSchema.safeParse({ category: "study", minutes: 5000 }).success).toBe(false);
  });
});

describe("money metric parameters", () => {
  it("lets spend goals use any category or none", () => {
    const spend = { name: "Food", type: "numeric", period: "monthly", metricKey: "spend" };
    expect(goalInputSchema.safeParse(spend).success).toBe(true);
    expect(goalInputSchema.safeParse({ ...spend, metricParam: "food" }).success).toBe(true);
    expect(goalInputSchema.safeParse({ ...spend, metricParam: "study" }).success).toBe(false);
  });
});
