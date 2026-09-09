import { describe, expect, it } from "vitest";
import {
  addGoalInput,
  addNoteInput,
  completeGoalInput,
  getWeightHistoryInput,
  logFoodInput,
  logSleepInput,
  logWaterInput,
  logWeightInput,
  logWorkoutInput,
  removeGoalInput,
  updateGoalInput,
} from "@/mcp/schemas";

const VALID_UUID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("MCP input validation", () => {
  it("accepts a minimal food entry with calories only", () => {
    const parsed = logFoodInput.parse({ foodName: "Oats", calories: 420 });
    expect(parsed.protein).toBeUndefined();
    expect(parsed.carbs).toBeUndefined();
  });

  it("rejects impossible nutrition values", () => {
    expect(logFoodInput.safeParse({ foodName: "x", calories: -10 }).success).toBe(false);
    expect(logFoodInput.safeParse({ foodName: "x", calories: 999_999 }).success).toBe(false);
    expect(logFoodInput.safeParse({ foodName: "x", calories: Number.NaN }).success).toBe(false);
    expect(logFoodInput.safeParse({ foodName: "x", calories: Infinity }).success).toBe(false);
    expect(logFoodInput.safeParse({ foodName: "", calories: 100 }).success).toBe(false);
    expect(logFoodInput.safeParse({ foodName: "x", calories: 100, protein: -1 }).success).toBe(false);
  });

  it("rejects malformed timestamps and out-of-range years", () => {
    expect(logFoodInput.safeParse({ foodName: "x", calories: 1, timestamp: "yesterday" }).success).toBe(false);
    expect(logFoodInput.safeParse({ foodName: "x", calories: 1, timestamp: "1876-01-01T00:00:00Z" }).success).toBe(false);
    expect(logFoodInput.safeParse({ foodName: "x", calories: 1, timestamp: "2026-09-09T10:00:00Z" }).success).toBe(true);
  });

  it("bounds water to a plausible single serving", () => {
    expect(logWaterInput.safeParse({ milliliters: 500 }).success).toBe(true);
    expect(logWaterInput.safeParse({ milliliters: 0 }).success).toBe(false);
    expect(logWaterInput.safeParse({ milliliters: 50_000 }).success).toBe(false);
    expect(logWaterInput.safeParse({ milliliters: 250.5 }).success).toBe(false);
  });

  it("bounds body weight", () => {
    expect(logWeightInput.safeParse({ kilograms: 50.4 }).success).toBe(true);
    expect(logWeightInput.safeParse({ kilograms: 0 }).success).toBe(false);
    expect(logWeightInput.safeParse({ kilograms: 900 }).success).toBe(false);
  });

  it("requires sleep to end after it starts and stay under a day", () => {
    expect(
      logSleepInput.safeParse({
        startTime: "2026-09-08T23:00:00Z",
        endTime: "2026-09-09T06:30:00Z",
      }).success,
    ).toBe(true);
    expect(
      logSleepInput.safeParse({
        startTime: "2026-09-09T06:30:00Z",
        endTime: "2026-09-08T23:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      logSleepInput.safeParse({
        startTime: "2026-09-01T00:00:00Z",
        endTime: "2026-09-03T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(
      logSleepInput.safeParse({
        startTime: "2026-09-08T23:00:00Z",
        endTime: "2026-09-09T06:30:00Z",
        quality: 9,
      }).success,
    ).toBe(false);
  });

  it("rejects malformed calendar dates", () => {
    expect(logWorkoutInput.safeParse({ workoutName: "Push", date: "2026-02-30" }).success).toBe(false);
    expect(logWorkoutInput.safeParse({ workoutName: "Push", date: "09-09-2026" }).success).toBe(false);
    expect(logWorkoutInput.safeParse({ workoutName: "Push", date: "2026-09-09" }).success).toBe(true);
    expect(addNoteInput.safeParse({ note: "hi", date: "2026-13-01" }).success).toBe(false);
  });

  it("validates goal creation and rejects unknown enums", () => {
    expect(
      addGoalInput.safeParse({ name: "Reading", type: "duration", period: "daily", targetValue: 0.5 })
        .success,
    ).toBe(true);
    expect(addGoalInput.safeParse({ name: "x", type: "gauge", period: "daily" }).success).toBe(false);
    expect(addGoalInput.safeParse({ name: "x", type: "numeric", period: "fortnightly" }).success).toBe(false);
    expect(
      addGoalInput.safeParse({ name: "x", type: "numeric", period: "daily", metricKey: "steps" })
        .success,
    ).toBe(false);
  });

  it("requires a real UUID for goal ids", () => {
    expect(removeGoalInput.safeParse({ goalId: VALID_UUID }).success).toBe(true);
    expect(removeGoalInput.safeParse({ goalId: "1" }).success).toBe(false);
    expect(completeGoalInput.safeParse({ goalId: "not-a-uuid" }).success).toBe(false);
    expect(updateGoalInput.safeParse({ goalId: VALID_UUID, active: false }).success).toBe(true);
  });

  it("bounds the weight history range", () => {
    expect(
      getWeightHistoryInput.safeParse({ startDate: "2026-01-01", endDate: "2026-01-31" }).success,
    ).toBe(true);
    expect(
      getWeightHistoryInput.safeParse({ startDate: "2026-02-01", endDate: "2026-01-01" }).success,
    ).toBe(false);
    expect(
      getWeightHistoryInput.safeParse({ startDate: "2020-01-01", endDate: "2026-01-01" }).success,
    ).toBe(false);
  });

  it("strips surrounding whitespace from text fields", () => {
    expect(addNoteInput.parse({ note: "  felt strong  " }).note).toBe("felt strong");
    expect(addNoteInput.safeParse({ note: "   " }).success).toBe(false);
  });
});
