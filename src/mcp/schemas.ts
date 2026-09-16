import { z } from "zod";
import { validateMetricParam } from "@/lib/validation";
import {
  accountKindSchema,
  amountSchema,
  applicationStageSchema,
  areaKeySchema,
  billRecurrenceSchema,
  expenseCategorySchema,
  blockKindSchema,
  caloriesSchema,
  hhmmSchema,
  weekdaySchema,
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
  minutesSchema,
  taskPrioritySchema,
  taskStatusSchema,
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
  estimated: z
    .boolean()
    .describe(
      "Set true when calories/macros are your typical-value estimate rather than figures the user gave. Estimates are shown with ≈.",
    )
    .optional(),
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

export const addGoalInput = z
  .object({
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
        "Derive progress automatically from logged entries. Omit for a goal recorded by hand with complete_goal. time_minutes needs metricParam.",
      )
      .optional(),
    metricParam: z
      .string()
      .trim()
      .max(40)
      .describe(
        "For time_minutes: a life area (required). For spend: an expense category (optional, omit for all spending).",
      )
      .optional(),
    area: areaKeySchema.describe("Life area this goal belongs to.").optional(),
    visibleOnDashboard: z.boolean().optional(),
    showInChecklist: z.boolean().optional(),
  })
  .superRefine(validateMetricParam);

export const updateGoalInput = z.object({
  goalId: uuidSchema,
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  type: goalTypeSchema.optional(),
  unit: z.string().trim().max(20).nullable().optional(),
  targetValue: z.number().finite().min(0).max(1_000_000).nullable().optional(),
  period: goalPeriodSchema.optional(),
  metricKey: metricKeySchema.nullable().optional(),
  metricParam: z.string().trim().max(40).nullable().optional(),
  area: areaKeySchema.nullable().optional(),
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

// --- Tasks -----------------------------------------------------------------

/** Either an id or a name; names are matched loosely against open items. */
const taskId = uuidSchema.describe("The task's id, if known.").optional();

export const addTaskInput = z.object({
  title: z.string().trim().min(1).max(160).describe("What needs doing."),
  area: areaKeySchema.describe("Life area, e.g. career or freelance.").optional(),
  dueDate: localDateSchema.describe("YYYY-MM-DD. Omit for no deadline.").optional(),
  priority: taskPrioritySchema.describe("low | medium | high. Defaults to medium.").optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const completeTaskInput = z
  .object({
    taskId,
    title: z.string().trim().min(1).max(160).describe("Name of the task, matched loosely.").optional(),
    date: localDateSchema.describe("Day it was completed. Defaults to today.").optional(),
  })
  .refine((v) => v.taskId || v.title, { message: "Give a taskId or a title", path: ["title"] });

export const updateTaskInput = z
  .object({
    taskId,
    match: z.string().trim().min(1).max(160).describe("Current title, matched loosely.").optional(),
    title: z.string().trim().min(1).max(160).optional(),
    area: areaKeySchema.nullable().optional(),
    dueDate: localDateSchema.nullable().optional(),
    priority: taskPrioritySchema.optional(),
    status: taskStatusSchema.optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((v) => v.taskId || v.match, { message: "Give a taskId or a match", path: ["match"] });

export const listTasksInput = z.object({
  status: z.enum(["todo", "done", "all"]).describe("Defaults to todo.").optional(),
  area: areaKeySchema.optional(),
  dueBefore: localDateSchema.describe("Only tasks due on or before this day (undated included).").optional(),
});

export const deleteTaskInput = z
  .object({
    taskId,
    title: z.string().trim().min(1).max(160).optional(),
  })
  .refine((v) => v.taskId || v.title, { message: "Give a taskId or a title", path: ["title"] });

// --- Time tracking ---------------------------------------------------------

export const startTimerInput = z.object({
  category: areaKeySchema.describe("What the time is for: study, freelance, work, career…"),
  label: z.string().trim().max(120).describe('Optional detail, e.g. "system design prep".').optional(),
});

export const stopTimerInput = z.object({
  notes: z.string().trim().max(500).optional(),
});

export const logTimeInput = z.object({
  category: areaKeySchema,
  minutes: minutesSchema.describe("Length of the finished session in minutes."),
  label: z.string().trim().max(120).optional(),
  date: localDateSchema.describe("Day of the session. Defaults to today.").optional(),
  notes: z.string().trim().max(500).optional(),
});

// --- Career ----------------------------------------------------------------

const applicationId = uuidSchema.describe("The application's id, if known.").optional();

export const addApplicationInput = z.object({
  company: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(120),
  stage: applicationStageSchema
    .describe("wishlist | applied | screening | interview | offer | rejected. Defaults to wishlist.")
    .optional(),
  url: z.string().trim().url().max(500).optional(),
  location: z.string().trim().max(120).optional(),
  salaryNote: z.string().trim().max(120).optional(),
  nextStep: z.string().trim().max(200).describe('e.g. "Prepare for system design round".').optional(),
  nextStepDate: localDateSchema.optional(),
  appliedOn: localDateSchema.describe("Defaults to today for any stage past wishlist.").optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateApplicationInput = z
  .object({
    applicationId,
    company: z.string().trim().min(1).max(120).describe("Company name, matched loosely, to find the application.").optional(),
    role: z.string().trim().min(1).max(120).optional(),
    stage: applicationStageSchema.optional(),
    url: z.string().trim().url().max(500).nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
    salaryNote: z.string().trim().max(120).nullable().optional(),
    nextStep: z.string().trim().max(200).nullable().optional(),
    nextStepDate: localDateSchema.nullable().optional(),
    appliedOn: localDateSchema.nullable().optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.applicationId || v.company, {
    message: "Give an applicationId or a company",
    path: ["company"],
  });

export const listApplicationsInput = z.object({
  stage: applicationStageSchema.optional(),
  includeArchived: z.boolean().optional(),
});

export const archiveApplicationInput = z
  .object({
    applicationId,
    company: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => v.applicationId || v.company, {
    message: "Give an applicationId or a company",
    path: ["company"],
  });

// --- Daily plan ------------------------------------------------------------

export const getDayPlanInput = z.object({
  date: localDateSchema.describe("Defaults to today.").optional(),
});

export const planDayInput = z.object({
  date: localDateSchema.describe("Defaults to today.").optional(),
});

export const addBlockInput = z
  .object({
    date: localDateSchema.describe("Defaults to today.").optional(),
    startTime: hhmmSchema.describe("HH:MM, 24-hour, in the user's timezone."),
    endTime: hhmmSchema,
    label: z.string().trim().min(1).max(120),
    kind: blockKindSchema.describe("routine | task | meal | workout | study | other").optional(),
    area: areaKeySchema.optional(),
    taskId: uuidSchema.optional(),
  })
  .refine((v) => v.endTime > v.startTime, { message: "endTime must be after startTime", path: ["endTime"] });

export const completeBlockInput = z
  .object({
    blockId: uuidSchema.optional(),
    label: z.string().trim().min(1).max(120).describe("Block label, matched loosely.").optional(),
    date: localDateSchema.describe("Defaults to today.").optional(),
    done: z.boolean().describe("Defaults to true.").optional(),
  })
  .refine((v) => v.blockId || v.label, { message: "Give a blockId or a label", path: ["label"] });

export const addRoutineInput = z
  .object({
    label: z.string().trim().min(1).max(120),
    startTime: hhmmSchema,
    endTime: hhmmSchema,
    weekdays: z.array(weekdaySchema).min(1).describe('Days it repeats, e.g. ["mon","wed","fri"].'),
    kind: blockKindSchema.optional(),
    area: areaKeySchema.optional(),
  })
  .refine((v) => v.endTime > v.startTime, { message: "endTime must be after startTime", path: ["endTime"] });

export const removeRoutineInput = z
  .object({
    routineId: uuidSchema.optional(),
    label: z.string().trim().min(1).max(120).optional(),
  })
  .refine((v) => v.routineId || v.label, { message: "Give a routineId or a label", path: ["label"] });

// --- Money -----------------------------------------------------------------

const accountName = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .describe("Account name, matched loosely (e.g. \"HDFC\", \"cash\", \"credit card\").")
  .optional();

export const logExpenseInput = z.object({
  amount: amountSchema.describe("Amount spent, in the user's currency."),
  category: expenseCategorySchema.describe("Defaults to other.").optional(),
  label: z.string().trim().max(120).describe('What it was, e.g. "lunch", "auto to office".').optional(),
  account: accountName,
  timestamp: isoTimestampSchema.describe("Defaults to now.").optional(),
  notes: z.string().trim().max(500).optional(),
});

export const logIncomeInput = z.object({
  amount: amountSchema,
  label: z.string().trim().max(120).describe('e.g. "salary", "freelance invoice #12".').optional(),
  account: accountName,
  timestamp: isoTimestampSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});

export const addBillInput = z.object({
  name: z.string().trim().min(1).max(80),
  amount: amountSchema,
  dueDate: localDateSchema,
  recurrence: billRecurrenceSchema.describe("none | monthly. Defaults to none.").optional(),
  category: expenseCategorySchema.describe("Defaults to bills.").optional(),
  account: accountName,
  notes: z.string().trim().max(500).optional(),
});

export const payBillInput = z
  .object({
    billId: uuidSchema.optional(),
    name: z.string().trim().min(1).max(80).describe("Bill name, matched loosely among pending bills.").optional(),
    account: accountName,
    date: localDateSchema.describe("Payment day. Defaults to today.").optional(),
  })
  .refine((v) => v.billId || v.name, { message: "Give a billId or a name", path: ["name"] });

export const setAccountInput = z.object({
  name: z.string().trim().min(1).max(60),
  kind: accountKindSchema.describe("bank | cash | credit_card | wallet. Defaults to bank.").optional(),
  balance: z
    .number()
    .finite()
    .min(-100_000_000)
    .max(100_000_000)
    .describe("Current balance (for a credit card: amount currently owed). Overwrites the running balance.")
    .optional(),
  creditLimit: amountSchema.optional(),
  statementDay: z.number().int().min(1).max(31).optional(),
  dueDay: z.number().int().min(1).max(31).describe("Day of month the card payment is due.").optional(),
});

export const getMoneySummaryInput = z.object({});

export const deleteTransactionInput = z.object({
  transactionId: uuidSchema.describe("From get_money_summary's recent list."),
});
