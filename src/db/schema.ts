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
  DashboardSectionVisibility,
  EntrySource,
  GoalPeriod,
  GoalType,
  MealType,
  MetricKey,
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

/** Append-only audit trail for every MCP mutation. */
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
