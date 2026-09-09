import { z } from "zod";
import {
  GOAL_PERIODS,
  GOAL_TYPES,
  MEAL_TYPES,
  METRIC_KEYS,
  THEMES,
  UNIT_SYSTEMS,
} from "./domain";
import { isLocalDate, isValidTimeZone } from "./date";

/**
 * One set of schemas shared by the web server actions and the MCP tools, so
 * both entry points reject exactly the same malformed input.
 */

export const localDateSchema = z
  .string()
  .refine(isLocalDate, "Expected a calendar date in YYYY-MM-DD format");

export const isoTimestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Expected an ISO-8601 timestamp")
  .refine((value) => {
    const year = new Date(value).getUTCFullYear();
    return year >= 2000 && year <= 2100;
  }, "Timestamp is outside the supported range (2000-2100)");

export const timeZoneSchema = z.string().refine(isValidTimeZone, "Unknown IANA time zone");

/** Bounded, finite quantities. Rejects NaN, Infinity and absurd magnitudes. */
const bounded = (max: number, label: string, min = 0) =>
  z
    .number()
    .finite(`${label} must be a finite number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max}`);

export const caloriesSchema = bounded(20_000, "Calories");
export const macroSchema = bounded(2_000, "Macronutrient grams");
export const quantitySchema = bounded(10_000, "Quantity", 0.001);
export const millilitersSchema = z
  .number()
  .int("Millilitres must be a whole number")
  .min(1, "Millilitres must be at least 1")
  .max(10_000, "Millilitres must be at most 10000");
export const kilogramsSchema = bounded(500, "Weight in kilograms", 1);
export const qualitySchema = z.number().int().min(1).max(5);

export const goalTypeSchema = z.enum(GOAL_TYPES);
export const goalPeriodSchema = z.enum(GOAL_PERIODS);
export const mealTypeSchema = z.enum(MEAL_TYPES);
export const metricKeySchema = z.enum(METRIC_KEYS);
export const themeSchema = z.enum(THEMES);
export const unitSystemSchema = z.enum(UNIT_SYSTEMS);

export const uuidSchema = z.string().uuid("Expected a UUID");

export const goalInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(500).nullish(),
  type: goalTypeSchema,
  unit: z.string().trim().max(20).nullish(),
  targetValue: bounded(1_000_000, "Target").nullish(),
  period: goalPeriodSchema,
  metricKey: metricKeySchema.nullish(),
  visibleOnDashboard: z.boolean().default(true),
  showInChecklist: z.boolean().default(true),
  color: z.string().trim().max(32).nullish(),
  icon: z.string().trim().max(32).nullish(),
});
export type GoalInput = z.infer<typeof goalInputSchema>;

export const goalUpdateSchema = goalInputSchema
  .partial()
  .extend({ active: z.boolean().optional(), sortOrder: z.number().int().min(0).optional() });
export type GoalUpdate = z.infer<typeof goalUpdateSchema>;

export const foodLogInputSchema = z.object({
  name: z.string().trim().min(1, "Food name is required").max(120),
  calories: caloriesSchema,
  proteinG: macroSchema.nullish(),
  carbsG: macroSchema.nullish(),
  fatG: macroSchema.nullish(),
  quantity: quantitySchema.default(1),
  unit: z.string().trim().max(20).default("serving"),
  mealType: mealTypeSchema.default("other"),
  notes: z.string().trim().max(500).nullish(),
  occurredAt: isoTimestampSchema.nullish(),
  foodId: uuidSchema.nullish(),
});
export type FoodLogInput = z.infer<typeof foodLogInputSchema>;

export const foodInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  calories: caloriesSchema,
  proteinG: macroSchema.nullish(),
  carbsG: macroSchema.nullish(),
  fatG: macroSchema.nullish(),
  servingQuantity: quantitySchema.default(1),
  servingUnit: z.string().trim().max(20).default("serving"),
});

export const waterInputSchema = z.object({
  milliliters: millilitersSchema,
  occurredAt: isoTimestampSchema.nullish(),
});

export const weightInputSchema = z.object({
  kilograms: kilogramsSchema,
  occurredAt: isoTimestampSchema.nullish(),
  note: z.string().trim().max(300).nullish(),
});

export const sleepInputSchema = z
  .object({
    startTime: isoTimestampSchema,
    endTime: isoTimestampSchema,
    quality: qualitySchema.nullish(),
    note: z.string().trim().max(300).nullish(),
  })
  .refine((v) => Date.parse(v.endTime) > Date.parse(v.startTime), {
    message: "endTime must be after startTime",
    path: ["endTime"],
  })
  .refine(
    (v) => Date.parse(v.endTime) - Date.parse(v.startTime) <= 24 * 3_600_000,
    { message: "A single sleep entry cannot exceed 24 hours", path: ["endTime"] },
  );

export const workoutInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  date: localDateSchema.nullish(),
  notes: z.string().trim().max(1000).nullish(),
  templateId: uuidSchema.nullish(),
});

export const exerciseInputSchema = z.object({
  workoutId: uuidSchema,
  name: z.string().trim().min(1).max(80),
  muscleGroup: z.string().trim().max(40).nullish(),
});

export const setInputSchema = z.object({
  exerciseId: uuidSchema,
  reps: z.number().int().min(0).max(1000).nullish(),
  weightKg: bounded(1000, "Set weight").nullish(),
  durationSeconds: z.number().int().min(0).max(86_400).nullish(),
  rpe: z.number().min(0).max(10).nullish(),
  completed: z.boolean().default(false),
});

export const noteInputSchema = z.object({
  note: z.string().trim().min(1, "Note cannot be empty").max(2000),
  date: localDateSchema.nullish(),
});

export const goalEntryInputSchema = z.object({
  goalId: uuidSchema,
  date: localDateSchema.nullish(),
  value: bounded(1_000_000, "Value").nullish(),
  note: z.string().trim().max(300).nullish(),
});

export const profileInputSchema = z.object({
  displayName: z.string().trim().max(60).nullish(),
  heightCm: bounded(300, "Height", 30).nullish(),
  startingWeightKg: kilogramsSchema.nullish(),
  targetWeightKg: kilogramsSchema.nullish(),
  timezone: timeZoneSchema.optional(),
  unitSystem: unitSystemSchema.optional(),
  theme: themeSchema.optional(),
  dashboardSections: z.record(z.string(), z.boolean()).optional(),
});

export const dateRangeSchema = z
  .object({ startDate: localDateSchema, endDate: localDateSchema })
  .refine((v) => v.startDate <= v.endDate, {
    message: "startDate must not be after endDate",
    path: ["startDate"],
  })
  .refine((v) => {
    const [ay, am, ad] = v.startDate.split("-").map(Number);
    const [by, bm, bd] = v.endDate.split("-").map(Number);
    const days = (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000;
    return days <= 366;
  }, "Date range cannot exceed 366 days");

/** Formats a ZodError into a single readable line for tool/action responses. */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
