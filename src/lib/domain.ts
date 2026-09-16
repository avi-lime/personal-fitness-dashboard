/**
 * Domain vocabulary shared by the database schema, the pure calculation layer,
 * the UI and the MCP server. Keeping these here (rather than in the Drizzle
 * schema) lets the calculation modules stay free of any database import.
 */

export const GOAL_TYPES = ["numeric", "duration", "boolean", "count"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_PERIODS = ["daily", "weekly", "monthly", "one_time"] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "other"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const ENTRY_SOURCES = ["web", "mcp", "assistant", "seed"] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const UNIT_SYSTEMS = ["metric", "imperial"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Metrics that the app can derive automatically from logged events.
 * A goal with `metricKey === null` is a *manual* goal: its progress comes from
 * explicit goal entries instead.
 *
 * To add a new automatic metric see `src/lib/metrics.ts` (single registry) and
 * the "Adding a goal type or metric" section of the README.
 */
export const METRIC_KEYS = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "water_ml",
  "sleep_hours",
  "workouts",
  "body_weight_kg",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export const GOAL_STATUSES = ["not_started", "in_progress", "complete"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** The dashboard sections a user can show or hide. */
export const DASHBOARD_SECTIONS = [
  "nextAction",
  "today",
  "quickActions",
  "training",
  "body",
  "weekly",
  "notes",
] as const;
export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

export type DashboardSectionVisibility = Record<DashboardSection, boolean>;

export const DEFAULT_DASHBOARD_SECTIONS: DashboardSectionVisibility = {
  nextAction: true,
  today: true,
  quickActions: true,
  training: true,
  body: true,
  weekly: true,
  notes: true,
};
