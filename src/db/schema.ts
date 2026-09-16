import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  AccountKind,
  ApplicationStage,
  AreaKey,
  BillRecurrence,
  BillStatus,
  BlockKind,
  DashboardSectionVisibility,
  ExpenseCategory,
  TransactionKind,
  EntrySource,
  GoalPeriod,
  GoalType,
  MealType,
  MetricKey,
  TaskPriority,
  TaskStatus,
  Theme,
  UnitSystem,
} from "@/lib/domain";

/**
 * Measurements are stored as `double precision` rather than `numeric` so the
 * driver hands back numbers instead of strings; the precision is far beyond
 * what body/nutrition data needs.
 *
 * Every event table carries both `occurredAt` (absolute instant) and
 * `localDate` (the user's calendar day). The latter is a bucketing key, not a
 * cached aggregate — daily and weekly totals are always recomputed from events.
 */

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const users = pgTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  createdAt: createdAt(),
});

export const profiles = pgTable("profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name"),
  heightCm: doublePrecision("height_cm"),
  startingWeightKg: doublePrecision("starting_weight_kg"),
  targetWeightKg: doublePrecision("target_weight_kg"),
  timezone: text("timezone").notNull().default("UTC"),
  unitSystem: text("unit_system").$type<UnitSystem>().notNull().default("metric"),
  theme: text("theme").$type<Theme>().notNull().default("system"),
  currency: text("currency").notNull().default("INR"),
  dashboardSections: jsonb("dashboard_sections").$type<Partial<DashboardSectionVisibility>>(),
  updatedAt: updatedAt(),
});

export const goals = pgTable(
  "goals",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type").$type<GoalType>().notNull(),
    unit: text("unit"),
    targetValue: doublePrecision("target_value"),
    period: text("period").$type<GoalPeriod>().notNull().default("daily"),
    /** null = manual goal, progress comes from `goalEntries`. */
    metricKey: text("metric_key").$type<MetricKey>(),
    /** Parameter for metrics that need one, e.g. the category of time tracked. */
    metricParam: text("metric_param"),
    area: text("area").$type<AreaKey>(),
    active: boolean("active").notNull().default(true),
    visibleOnDashboard: boolean("visible_on_dashboard").notNull().default(true),
    showInChecklist: boolean("show_in_checklist").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    color: text("color"),
    icon: text("icon"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("goals_user_idx").on(table.userId, table.sortOrder)],
);

export const goalEntries = pgTable(
  "goal_entries",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    localDate: date("local_date").notNull(),
    value: doublePrecision("value").notNull().default(1),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
  },
  (table) => [index("goal_entries_lookup_idx").on(table.userId, table.localDate, table.goalId)],
);

export const foods = pgTable(
  "foods",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    calories: doublePrecision("calories").notNull().default(0),
    proteinG: doublePrecision("protein_g"),
    carbsG: doublePrecision("carbs_g"),
    fatG: doublePrecision("fat_g"),
    servingQuantity: doublePrecision("serving_quantity").notNull().default(1),
    servingUnit: text("serving_unit").notNull().default("serving"),
    /** True when the macros came from an AI estimate rather than a label. */
    estimated: boolean("estimated").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("foods_user_name_idx").on(table.userId, table.name)],
);

export const foodLogs = pgTable(
  "food_logs",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    calories: doublePrecision("calories").notNull().default(0),
    proteinG: doublePrecision("protein_g"),
    carbsG: doublePrecision("carbs_g"),
    fatG: doublePrecision("fat_g"),
    quantity: doublePrecision("quantity").notNull().default(1),
    unit: text("unit").notNull().default("serving"),
    mealType: text("meal_type").$type<MealType>().notNull().default("other"),
    notes: text("notes"),
    /** True when the macros are an AI estimate; shown with "≈" in the UI. */
    estimated: boolean("estimated").notNull().default(false),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    localDate: date("local_date").notNull(),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
  },
  (table) => [index("food_logs_day_idx").on(table.userId, table.localDate)],
);

export const mealTemplates = pgTable(
  "meal_templates",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mealType: text("meal_type").$type<MealType>().notNull().default("other"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("meal_templates_user_name_idx").on(table.userId, table.name)],
);

export const mealTemplateItems = pgTable(
  "meal_template_items",
  {
    id: id(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => mealTemplates.id, { onDelete: "cascade" }),
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    calories: doublePrecision("calories").notNull().default(0),
    proteinG: doublePrecision("protein_g"),
    carbsG: doublePrecision("carbs_g"),
    fatG: doublePrecision("fat_g"),
    quantity: doublePrecision("quantity").notNull().default(1),
    unit: text("unit").notNull().default("serving"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("meal_template_items_template_idx").on(table.templateId, table.sortOrder)],
);

export const waterLogs = pgTable(
  "water_logs",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    milliliters: integer("milliliters").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    localDate: date("local_date").notNull(),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
  },
  (table) => [index("water_logs_day_idx").on(table.userId, table.localDate)],
);

export const weightEntries = pgTable(
  "weight_entries",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weightKg: doublePrecision("weight_kg").notNull(),
    note: text("note"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    localDate: date("local_date").notNull(),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
  },
  (table) => [index("weight_entries_day_idx").on(table.userId, table.localDate)],
);

export const sleepEntries = pgTable(
  "sleep_entries",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    /** Attributed to the day the user woke up. */
    localDate: date("local_date").notNull(),
    quality: integer("quality"),
    note: text("note"),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
  },
  (table) => [index("sleep_entries_day_idx").on(table.userId, table.localDate)],
);

export const workoutTemplates = pgTable(
  "workout_templates",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("workout_templates_user_name_idx").on(table.userId, table.name)],
);

export const workoutTemplateExercises = pgTable(
  "workout_template_exercises",
  {
    id: id(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    muscleGroup: text("muscle_group"),
    sortOrder: integer("sort_order").notNull().default(0),
    targetSets: integer("target_sets").notNull().default(3),
    targetReps: integer("target_reps").notNull().default(10),
  },
  (table) => [index("workout_template_exercises_idx").on(table.templateId, table.sortOrder)],
);

export const workouts = pgTable(
  "workouts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    templateId: uuid("template_id").references(() => workoutTemplates.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    localDate: date("local_date").notNull(),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("workouts_day_idx").on(table.userId, table.localDate)],
);

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: id(),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    muscleGroup: text("muscle_group"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("workout_exercises_idx").on(table.workoutId, table.sortOrder)],
);

export const workoutSets = pgTable(
  "workout_sets",
  {
    id: id(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => workoutExercises.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    reps: integer("reps"),
    weightKg: doublePrecision("weight_kg"),
    durationSeconds: integer("duration_seconds"),
    rpe: doublePrecision("rpe"),
    completed: boolean("completed").notNull().default(false),
  },
  (table) => [index("workout_sets_idx").on(table.exerciseId, table.sortOrder)],
);

export const notes = pgTable(
  "notes",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    localDate: date("local_date").notNull(),
    body: text("body").notNull(),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("notes_day_idx").on(table.userId, table.localDate)],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    area: text("area").$type<AreaKey>(),
    dueDate: date("due_date"),
    priority: text("priority").$type<TaskPriority>().notNull().default("medium"),
    status: text("status").$type<TaskStatus>().notNull().default("todo"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** The user's calendar day of completion — what daily goals count. */
    completedOn: date("completed_on"),
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("tasks_open_idx").on(table.userId, table.status, table.dueDate),
    index("tasks_completed_idx").on(table.userId, table.completedOn),
  ],
);

export const timeEntries = pgTable(
  "time_entries",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: text("category").$type<AreaKey>().notNull(),
    label: text("label"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    /** Null while the timer is running. */
    endAt: timestamp("end_at", { withTimezone: true }),
    /** Set when the entry ends; null while running. */
    durationMinutes: integer("duration_minutes"),
    /** The day the session started. */
    localDate: date("local_date").notNull(),
    notes: text("notes"),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
  },
  (table) => [index("time_entries_day_idx").on(table.userId, table.localDate)],
);

export const applications = pgTable(
  "applications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    company: text("company").notNull(),
    role: text("role").notNull(),
    stage: text("stage").$type<ApplicationStage>().notNull().default("wishlist"),
    url: text("url"),
    location: text("location"),
    salaryNote: text("salary_note"),
    nextStep: text("next_step"),
    nextStepDate: date("next_step_date"),
    /** The day the application was actually sent — what "applications sent" counts. */
    appliedOn: date("applied_on"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("applications_stage_idx").on(table.userId, table.stage),
    index("applications_applied_idx").on(table.userId, table.appliedOn),
  ],
);

/** A recurring block of the day, materialised into `timeBlocks` by "plan my day". */
export const routines = pgTable(
  "routines",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    kind: text("kind").$type<BlockKind>().notNull().default("routine"),
    area: text("area").$type<AreaKey>(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    /** Bitmask, Monday = 1 … Sunday = 64 (see `lib/plan.ts`). */
    weekdays: integer("weekdays").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("routines_user_idx").on(table.userId, table.startTime)],
);

export const timeBlocks = pgTable(
  "time_blocks",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    localDate: date("local_date").notNull(),
    /** Wall-clock HH:MM in the user's timezone. */
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    label: text("label").notNull(),
    kind: text("kind").$type<BlockKind>().notNull().default("other"),
    area: text("area").$type<AreaKey>(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    routineId: uuid("routine_id").references(() => routines.id, { onDelete: "set null" }),
    done: boolean("done").notNull().default(false),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
  },
  (table) => [index("time_blocks_day_idx").on(table.userId, table.localDate, table.startTime)],
);

/**
 * `balance` is money available for bank/cash/wallet and money *owed* for a
 * credit card (positive = outstanding). Every transaction adjusts it inside
 * the same database transaction, so the two never drift.
 */
export const moneyAccounts = pgTable(
  "money_accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").$type<AccountKind>().notNull().default("bank"),
    balance: doublePrecision("balance").notNull().default(0),
    creditLimit: doublePrecision("credit_limit"),
    statementDay: integer("statement_day"),
    dueDay: integer("due_day"),
    currency: text("currency").notNull().default("INR"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("money_accounts_user_name_idx").on(table.userId, table.name)],
);

export const transactions = pgTable(
  "transactions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => moneyAccounts.id, { onDelete: "set null" }),
    /** Destination for transfers. */
    transferAccountId: uuid("transfer_account_id").references(() => moneyAccounts.id, {
      onDelete: "set null",
    }),
    /** Always positive; `kind` carries the direction. */
    amount: doublePrecision("amount").notNull(),
    kind: text("kind").$type<TransactionKind>().notNull().default("expense"),
    category: text("category").$type<ExpenseCategory>().notNull().default("other"),
    label: text("label"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    localDate: date("local_date").notNull(),
    notes: text("notes"),
    /** Groups rows from one statement import (reserved for CSV import). */
    importBatchId: text("import_batch_id"),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
  },
  (table) => [index("transactions_day_idx").on(table.userId, table.localDate)],
);

export const bills = pgTable(
  "bills",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: doublePrecision("amount").notNull(),
    dueDate: date("due_date").notNull(),
    recurrence: text("recurrence").$type<BillRecurrence>().notNull().default("none"),
    category: text("category").$type<ExpenseCategory>().notNull().default("bills"),
    accountId: uuid("account_id").references(() => moneyAccounts.id, { onDelete: "set null" }),
    status: text("status").$type<BillStatus>().notNull().default("pending"),
    paidTransactionId: uuid("paid_transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    source: text("source").$type<EntrySource>().notNull().default("web"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("bills_due_idx").on(table.userId, table.status, table.dueDate)],
);

/** Append-only audit trail for every mutation made through a tool. */
export const mcpAuditLog = pgTable(
  "mcp_audit_log",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    arguments: jsonb("arguments").notNull().default(sql`'{}'::jsonb`),
    resultSummary: text("result_summary"),
    /** Who asked: an MCP client or the in-app assistant. */
    channel: text("channel").$type<EntrySource>().notNull().default("mcp"),
    createdAt: createdAt(),
  },
  (table) => [index("mcp_audit_log_idx").on(table.userId, table.createdAt)],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  goals: many(goals),
}));

export const goalsRelations = relations(goals, ({ many }) => ({
  entries: many(goalEntries),
}));

export const workoutsRelations = relations(workouts, ({ many, one }) => ({
  exercises: many(workoutExercises),
  template: one(workoutTemplates, {
    fields: [workouts.templateId],
    references: [workoutTemplates.id],
  }),
}));

export const workoutExercisesRelations = relations(workoutExercises, ({ many, one }) => ({
  sets: many(workoutSets),
  workout: one(workouts, { fields: [workoutExercises.workoutId], references: [workouts.id] }),
}));

export const workoutSetsRelations = relations(workoutSets, ({ one }) => ({
  exercise: one(workoutExercises, {
    fields: [workoutSets.exerciseId],
    references: [workoutExercises.id],
  }),
}));

export const mealTemplatesRelations = relations(mealTemplates, ({ many }) => ({
  items: many(mealTemplateItems),
}));

export const mealTemplateItemsRelations = relations(mealTemplateItems, ({ one }) => ({
  template: one(mealTemplates, {
    fields: [mealTemplateItems.templateId],
    references: [mealTemplates.id],
  }),
}));

export const workoutTemplatesRelations = relations(workoutTemplates, ({ many }) => ({
  exercises: many(workoutTemplateExercises),
}));

export const workoutTemplateExercisesRelations = relations(workoutTemplateExercises, ({ one }) => ({
  template: one(workoutTemplates, {
    fields: [workoutTemplateExercises.templateId],
    references: [workoutTemplates.id],
  }),
}));

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type FoodLog = typeof foodLogs.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type WaterLog = typeof waterLogs.$inferSelect;
export type WeightEntry = typeof weightEntries.$inferSelect;
export type SleepEntry = typeof sleepEntries.$inferSelect;
export type Workout = typeof workouts.$inferSelect;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Application = typeof applications.$inferSelect;
export type Routine = typeof routines.$inferSelect;
export type TimeBlock = typeof timeBlocks.$inferSelect;
export type MoneyAccount = typeof moneyAccounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Bill = typeof bills.$inferSelect;
