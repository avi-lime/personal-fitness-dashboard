import { z } from "zod";
import {
  caloriesSchema,
  dateRangeSchema,
  goalPeriodSchema,
  goalTypeSchema,
  isoTimestampSchema,
  kilogramsSchema,
  localDateSchema,
  macroSchema,
  mealTypeSchema,
  metricKeySchema,
  millilitersSchema,
  qualitySchema,
  quantitySchema,
  uuidSchema,
} from "@/lib/validation";

/**
 * MCP tool inputs. These reuse the same primitives as the web forms, so both
 * entry points reject the same malformed dates and impossible numbers.
 */

export const emptyInput = z.object({});

export const getGoalInput = z.object({
  goalId: uuidSchema.describe("The goal's id, as returned by get_goals."),
});

export const getFoodLogInput = z.object({
  date: localDateSchema.describe("Calendar day to read, YYYY-MM-DD.").optional(),
});

export const getWorkoutInput = z.object({
  date: localDateSchema.describe("Calendar day to read, YYYY-MM-DD.").optional(),
});

export const getWeightHistoryInput = dateRangeSchema;

export const getWeeklySummaryInput = z.object({
  weekStart: localDateSchema
    .describe("Any date in the week; it is snapped to that week's Monday.")
    .optional(),
});

export const logFoodInput = z.object({
  foodName: z.string().trim().min(1).max(120).describe("What was eaten."),
  calories: caloriesSchema.describe("Energy in kilocalories. Required."),
  protein: macroSchema.describe("Protein in grams. Omit if unknown.").optional(),
  carbs: macroSchema.describe("Carbohydrate in grams. Omit if unknown.").optional(),
  fat: macroSchema.describe("Fat in grams. Omit if unknown.").optional(),
  quantity: quantitySchema.describe("How many units. Defaults to 1.").optional(),
  unit: z.string().trim().max(20).describe('Unit for the quantity, e.g. "bowl".').optional(),
  mealType: mealTypeSchema.describe("Which meal this belongs to.").optional(),
  timestamp: isoTimestampSchema.describe("When it was eaten. Defaults to now.").optional(),
  notes: z.string().trim().max(500).optional(),
});

export const logWaterInput = z.object({
  milliliters: millilitersSchema.describe("Amount of water in millilitres (1–10000)."),
  timestamp: isoTimestampSchema.describe("Defaults to now.").optional(),
});

export const logWeightInput = z.object({
  kilograms: kilogramsSchema.describe("Body weight in kilograms."),
  timestamp: isoTimestampSchema.describe("Defaults to now.").optional(),
  note: z.string().trim().max(300).optional(),
});

export const logSleepInput = z
  .object({
    startTime: isoTimestampSchema.describe("When sleep started (ISO-8601)."),
    endTime: isoTimestampSchema.describe("When sleep ended (ISO-8601)."),
    quality: qualitySchema.describe("Optional subjective quality, 1–5.").optional(),
    note: z.string().trim().max(300).optional(),
  })
  .refine((value) => Date.parse(value.endTime) > Date.parse(value.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  })
  .refine(
    (value) => Date.parse(value.endTime) - Date.parse(value.startTime) <= 24 * 3_600_000,
    { message: "A single sleep entry cannot exceed 24 hours", path: ["endTime"] },
  );

export const logWorkoutInput = z.object({
  workoutName: z.string().trim().min(1).max(80).describe('Session name, e.g. "Push day".'),
  date: localDateSchema.describe("Calendar day. Defaults to today.").optional(),
  notes: z.string().trim().max(1000).optional(),
  completed: z
    .boolean()
    .describe("Mark the session as completed straight away. Defaults to true.")
    .optional(),
});

export const addGoalInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  type: goalTypeSchema.describe("numeric | duration | boolean | count."),
  unit: z.string().trim().max(20).describe('Display unit, e.g. "g" or "L".').optional(),
  targetValue: z
    .number()
    .finite()
    .min(0)
    .max(1_000_000)
    .describe("Target for the period. Omit to track without a target.")
    .optional(),
  period: goalPeriodSchema.describe("daily | weekly | monthly | one_time."),
  metricKey: metricKeySchema
    .describe(
      "Derive progress automatically from logged entries. Omit for a goal recorded by hand with complete_goal.",
    )
    .optional(),
  visibleOnDashboard: z.boolean().optional(),
  showInChecklist: z.boolean().optional(),
});

export const updateGoalInput = z.object({
  goalId: uuidSchema,
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  type: goalTypeSchema.optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  targetValue: z.number().finite().min(0).max(1_000_000).nullable().optional(),
  period: goalPeriodSchema.optional(),
  metricKey: metricKeySchema.nullable().optional(),
  active: z.boolean().describe("Set false to pause the goal.").optional(),
  visibleOnDashboard: z.boolean().optional(),
  showInChecklist: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const removeGoalInput = z.object({
  goalId: uuidSchema.describe("Archives the goal. Past entries are kept."),
});

export const completeGoalInput = z.object({
  goalId: uuidSchema,
  date: localDateSchema.describe("Calendar day. Defaults to today.").optional(),
  value: z
    .number()
    .finite()
    .min(0)
    .max(1_000_000)
    .describe("Amount to record. Defaults to 1.")
    .optional(),
});

export const addNoteInput = z.object({
  note: z.string().trim().min(1).max(2000),
  date: localDateSchema.describe("Calendar day. Defaults to today.").optional(),
});
