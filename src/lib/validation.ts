import { z } from "zod";
import {
  ACCOUNT_KINDS,
  APPLICATION_STAGES,
  AREA_KEYS,
  BILL_RECURRENCES,
  BLOCK_KINDS,
  EXPENSE_CATEGORIES,
  GOAL_PERIODS,
  GOAL_TYPES,
  MEAL_TYPES,
  METRIC_KEYS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  THEMES,
  UNIT_SYSTEMS,
} from "./domain";
import { isLocalDate, isValidTimeZone } from "./date";
import { METRICS } from "./metrics";
import { WEEKDAYS, isHHMM } from "./plan";

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
export const areaKeySchema = z.enum(AREA_KEYS);
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export const taskStatusSchema = z.enum(TASK_STATUSES);

/**
 * A goal's metric parameter must match what its metric declares: required
 * (and a known area) for parameterised metrics, absent for the rest. Shared by
 * the web form and the MCP/assistant tools.
 */
export function validateMetricParam(
  value: { metricKey?: string | null; metricParam?: string | null },
  ctx: { addIssue: (issue: { code: "custom"; message: string; path: string[] }) => void },
): void {
  const key = value.metricKey ?? null;
  const param = value.metricParam ?? null;
  if (key === null) {
    if (param !== null) {
      ctx.addIssue({ code: "custom", message: "metricParam requires a metricKey", path: ["metricParam"] });
    }
    return;
  }
  const metric = METRICS[key as keyof typeof METRICS];
  if (!metric) return;
  if (metric.param) {
    const allowed: readonly string[] = metric.param.kind === "area" ? AREA_KEYS : EXPENSE_CATEGORIES;
    if (param === null) {
      if (metric.param.required) {
        ctx.addIssue({
          code: "custom",
          message: `${metric.label} needs metricParam set to one of: ${allowed.join(", ")}`,
          path: ["metricParam"],
        });
      }
    } else if (!allowed.includes(param)) {
      ctx.addIssue({
        code: "custom",
        message: `${metric.label} takes metricParam from: ${allowed.join(", ")}`,
        path: ["metricParam"],
      });
    }
  } else if (param !== null) {
    ctx.addIssue({
      code: "custom",
      message: `${metric.label} does not take a metricParam`,
      path: ["metricParam"],
    });
  }
}
export const themeSchema = z.enum(THEMES);
export const unitSystemSchema = z.enum(UNIT_SYSTEMS);

export const uuidSchema = z.string().uuid("Expected a UUID");

const goalBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(500).nullish(),
  type: goalTypeSchema,
  unit: z.string().trim().max(20).nullish(),
  targetValue: bounded(1_000_000, "Target").nullish(),
  period: goalPeriodSchema,
  metricKey: metricKeySchema.nullish(),
  metricParam: z.string().trim().max(40).nullish(),
  area: areaKeySchema.nullish(),
  visibleOnDashboard: z.boolean().default(true),
  showInChecklist: z.boolean().default(true),
  color: z.string().trim().max(32).nullish(),
  icon: z.string().trim().max(32).nullish(),
});

export const goalInputSchema = goalBaseSchema.superRefine(validateMetricParam);
export type GoalInput = z.infer<typeof goalInputSchema>;

/**
 * A partial update can only be checked when both metric fields are present;
 * the service re-checks the merged result before writing.
 */
export const goalUpdateSchema = goalBaseSchema
  .partial()
  .extend({ active: z.boolean().optional(), sortOrder: z.number().int().min(0).optional() })
  .superRefine((value, ctx) => {
    if (value.metricKey !== undefined && value.metricParam !== undefined) {
      validateMetricParam(value, ctx);
    }
  });
export type GoalUpdate = z.infer<typeof goalUpdateSchema>;

// --- Tasks & time ----------------------------------------------------------

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  area: areaKeySchema.nullish(),
  dueDate: localDateSchema.nullish(),
  priority: taskPrioritySchema.default("medium"),
  notes: z.string().trim().max(1000).nullish(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;

export const taskUpdateSchema = taskInputSchema.partial().extend({
  status: taskStatusSchema.optional(),
});
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;

export const minutesSchema = z
  .number()
  .int("Minutes must be a whole number")
  .min(1, "Minutes must be at least 1")
  .max(24 * 60, "A session cannot exceed 24 hours");

export const timeEntryInputSchema = z.object({
  category: areaKeySchema,
  minutes: minutesSchema,
  label: z.string().trim().max(120).nullish(),
  date: localDateSchema.nullish(),
  notes: z.string().trim().max(500).nullish(),
});
export type TimeEntryInput = z.infer<typeof timeEntryInputSchema>;

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
  /** The macros are an estimate, not from a label or a scale. */
  estimated: z.boolean().default(false),
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
  estimated: z.boolean().default(false),
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

// --- Career ----------------------------------------------------------------

export const applicationStageSchema = z.enum(APPLICATION_STAGES);

export const applicationInputSchema = z.object({
  company: z.string().trim().min(1, "Company is required").max(120),
  role: z.string().trim().min(1, "Role is required").max(120),
  stage: applicationStageSchema.default("wishlist"),
  url: z.string().trim().url("Enter a full URL").max(500).nullish(),
  location: z.string().trim().max(120).nullish(),
  salaryNote: z.string().trim().max(120).nullish(),
  nextStep: z.string().trim().max(200).nullish(),
  nextStepDate: localDateSchema.nullish(),
  appliedOn: localDateSchema.nullish(),
  notes: z.string().trim().max(2000).nullish(),
});
export type ApplicationInput = z.infer<typeof applicationInputSchema>;

export const applicationUpdateSchema = applicationInputSchema.partial();
export type ApplicationUpdate = z.infer<typeof applicationUpdateSchema>;

// --- Daily plan ------------------------------------------------------------

export const hhmmSchema = z.string().refine(isHHMM, "Expected a time as HH:MM (24-hour)");
export const weekdaySchema = z.enum(WEEKDAYS);
export const blockKindSchema = z.enum(BLOCK_KINDS);

const endsAfterStart = (value: { startTime: string; endTime: string }) =>
  value.endTime > value.startTime;

export const routineInputSchema = z
  .object({
    label: z.string().trim().min(1, "Label is required").max(120),
    kind: blockKindSchema.default("routine"),
    area: areaKeySchema.nullish(),
    startTime: hhmmSchema,
    endTime: hhmmSchema,
    weekdays: z.array(weekdaySchema).min(1, "Pick at least one day"),
  })
  .refine(endsAfterStart, { message: "End time must be after start time", path: ["endTime"] });
export type RoutineInput = z.infer<typeof routineInputSchema>;

export const timeBlockInputSchema = z
  .object({
    date: localDateSchema.nullish(),
    startTime: hhmmSchema,
    endTime: hhmmSchema,
    label: z.string().trim().min(1, "Label is required").max(120),
    kind: blockKindSchema.default("other"),
    area: areaKeySchema.nullish(),
    taskId: uuidSchema.nullish(),
  })
  .refine(endsAfterStart, { message: "End time must be after start time", path: ["endTime"] });
export type TimeBlockInput = z.infer<typeof timeBlockInputSchema>;

// --- Money -----------------------------------------------------------------

export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
export const accountKindSchema = z.enum(ACCOUNT_KINDS);
export const billRecurrenceSchema = z.enum(BILL_RECURRENCES);

/** Money amounts: positive, finite, sane for a personal ledger. */
export const amountSchema = bounded(100_000_000, "Amount", 0.01);

export const accountInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  kind: accountKindSchema.default("bank"),
  balance: z.number().finite().min(-100_000_000).max(100_000_000).nullish(),
  creditLimit: bounded(100_000_000, "Credit limit").nullish(),
  statementDay: z.number().int().min(1).max(31).nullish(),
  dueDay: z.number().int().min(1).max(31).nullish(),
});
export type AccountInput = z.infer<typeof accountInputSchema>;

export const expenseInputSchema = z.object({
  amount: amountSchema,
  category: expenseCategorySchema.default("other"),
  label: z.string().trim().max(120).nullish(),
  accountId: uuidSchema.nullish(),
  occurredAt: isoTimestampSchema.nullish(),
  notes: z.string().trim().max(500).nullish(),
});
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const incomeInputSchema = z.object({
  amount: amountSchema,
  label: z.string().trim().max(120).nullish(),
  accountId: uuidSchema.nullish(),
  occurredAt: isoTimestampSchema.nullish(),
  notes: z.string().trim().max(500).nullish(),
});
export type IncomeInput = z.infer<typeof incomeInputSchema>;

export const transferInputSchema = z
  .object({
    amount: amountSchema,
    fromAccountId: uuidSchema,
    toAccountId: uuidSchema,
    label: z.string().trim().max(120).nullish(),
    occurredAt: isoTimestampSchema.nullish(),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, {
    message: "Pick two different accounts",
    path: ["toAccountId"],
  });
export type TransferInput = z.infer<typeof transferInputSchema>;

export const billInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  amount: amountSchema,
  dueDate: localDateSchema,
  recurrence: billRecurrenceSchema.default("none"),
  accountId: uuidSchema.nullish(),
  category: expenseCategorySchema.default("bills"),
  notes: z.string().trim().max(500).nullish(),
});
export type BillInput = z.infer<typeof billInputSchema>;
