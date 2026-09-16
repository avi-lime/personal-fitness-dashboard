import {
  AREA_LABELS,
  EXPENSE_CATEGORY_LABELS,
  type AreaKey,
  type ExpenseCategory,
  type GoalType,
  type MetricKey,
} from "./domain";
import type { LocalDate } from "./date";

/**
 * Facts derived from the events logged on a single local day. This is the only
 * shape the goal calculators understand, which keeps them pure and testable:
 * the database layer produces `DayFacts`, everything downstream is arithmetic.
 */
export interface DayFacts {
  date: LocalDate;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
  sleepHours: number;
  workoutCount: number;
  /** Latest weigh-in recorded on this day, if any. */
  weightKg: number | null;
  /** Totals from explicit goal entries, keyed by goal id (manual goals). */
  manualByGoalId: Record<string, number>;
  /** Finished time-tracking minutes, keyed by area/category. */
  minutesByCategory: Record<string, number>;
  tasksCompleted: number;
  /** Job applications whose `appliedOn` is this day. */
  applicationsSent: number;
  /** Expenses and bill payments by category, in the profile currency. */
  spendByCategory: Record<string, number>;
  income: number;
}

export function emptyDayFacts(date: LocalDate): DayFacts {
  return {
    date,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    waterMl: 0,
    sleepHours: 0,
    workoutCount: 0,
    weightKg: null,
    manualByGoalId: {},
    minutesByCategory: {},
    tasksCompleted: 0,
    applicationsSent: 0,
    spendByCategory: {},
    income: 0,
  };
}

/**
 * How a metric combines across several days.
 * - `sum`    : add the daily values (calories, water, …)
 * - `latest` : take the most recent non-null value (body weight)
 */
export type MetricAggregation = "sum" | "latest";

/**
 * Some metrics take a parameter — "time tracked" needs to know *which*
 * category. The parameter is stored on the goal (`metricParam`) and validated
 * against the kind declared here.
 */
export interface MetricParam {
  kind: "area" | "expenseCategory";
  /** Optional parameters mean "all" when absent (e.g. total spend). */
  required: boolean;
  label: string;
}

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  /** Unit suggested when a goal is created against this metric. */
  defaultUnit: string;
  /** Goal type suggested when a goal is created against this metric. */
  suggestedType: GoalType;
  aggregation: MetricAggregation;
  param?: MetricParam;
  select: (facts: DayFacts, param: string | null) => number | null;
}

/**
 * The single registry of automatic metrics. Adding a metric here makes it
 * immediately selectable when creating a goal, in the dashboard, and over MCP.
 */
export const METRICS: Readonly<Record<MetricKey, MetricDefinition>> = {
  calories: {
    key: "calories",
    label: "Calories from food log",
    defaultUnit: "kcal",
    suggestedType: "numeric",
    aggregation: "sum",
    select: (f) => f.calories,
  },
  protein: {
    key: "protein",
    label: "Protein from food log",
    defaultUnit: "g",
    suggestedType: "numeric",
    aggregation: "sum",
    select: (f) => f.protein,
  },
  carbs: {
    key: "carbs",
    label: "Carbs from food log",
    defaultUnit: "g",
    suggestedType: "numeric",
    aggregation: "sum",
    select: (f) => f.carbs,
  },
  fat: {
    key: "fat",
    label: "Fat from food log",
    defaultUnit: "g",
    suggestedType: "numeric",
    aggregation: "sum",
    select: (f) => f.fat,
  },
  water_ml: {
    key: "water_ml",
    label: "Water logged",
    defaultUnit: "L",
    suggestedType: "numeric",
    aggregation: "sum",
    // Goals are expressed in litres; water is logged in millilitres.
    select: (f) => f.waterMl / 1000,
  },
  sleep_hours: {
    key: "sleep_hours",
    label: "Sleep duration",
    defaultUnit: "h",
    suggestedType: "duration",
    aggregation: "sum",
    select: (f) => f.sleepHours,
  },
  workouts: {
    key: "workouts",
    label: "Completed workouts",
    defaultUnit: "sessions",
    suggestedType: "count",
    aggregation: "sum",
    select: (f) => f.workoutCount,
  },
  body_weight_kg: {
    key: "body_weight_kg",
    label: "Body weight",
    defaultUnit: "kg",
    suggestedType: "numeric",
    aggregation: "latest",
    select: (f) => f.weightKg,
  },
  time_minutes: {
    key: "time_minutes",
    label: "Time tracked",
    defaultUnit: "h",
    suggestedType: "duration",
    aggregation: "sum",
    param: { kind: "area", required: true, label: "Category" },
    // Goals are expressed in hours; sessions are stored in minutes.
    select: (f, param) => (param ? (f.minutesByCategory[param] ?? 0) / 60 : 0),
  },
  tasks_completed: {
    key: "tasks_completed",
    label: "Tasks completed",
    defaultUnit: "tasks",
    suggestedType: "count",
    aggregation: "sum",
    select: (f) => f.tasksCompleted,
  },
  applications_sent: {
    key: "applications_sent",
    label: "Job applications sent",
    defaultUnit: "applications",
    suggestedType: "count",
    aggregation: "sum",
    select: (f) => f.applicationsSent,
  },
  spend: {
    key: "spend",
    label: "Money spent",
    defaultUnit: "",
    suggestedType: "numeric",
    aggregation: "sum",
    param: { kind: "expenseCategory", required: false, label: "Category" },
    select: (f, param) =>
      param
        ? (f.spendByCategory[param] ?? 0)
        : Object.values(f.spendByCategory).reduce((sum, value) => sum + value, 0),
  },
  income: {
    key: "income",
    label: "Income received",
    defaultUnit: "",
    suggestedType: "numeric",
    aggregation: "sum",
    select: (f) => f.income,
  },
};

export const METRIC_LIST: MetricDefinition[] = Object.values(METRICS);

export function getMetric(key: MetricKey): MetricDefinition {
  return METRICS[key];
}

export function isMetricKey(value: string): value is MetricKey {
  return Object.prototype.hasOwnProperty.call(METRICS, value);
}

/** Display label for a goal's metric source, including its parameter. */
export function metricLabel(metricKey: MetricKey | null, metricParam: string | null): string {
  if (metricKey === null) return "Manual entries";
  const metric = METRICS[metricKey];
  if (!metric.param || !metricParam) return metric.label;
  const paramLabel =
    metric.param.kind === "area"
      ? (AREA_LABELS[metricParam as AreaKey] ?? metricParam)
      : (EXPENSE_CATEGORY_LABELS[metricParam as ExpenseCategory] ?? metricParam);
  return `${metric.label} · ${paramLabel}`;
}

/**
 * Resolves a metric (or a manual goal) across one or more days.
 * Returns `null` only for `latest` metrics that have no data at all.
 */
export function resolveMetric(
  metricKey: MetricKey | null,
  goalId: string,
  days: DayFacts[],
  metricParam: string | null = null,
): number | null {
  if (metricKey === null) {
    return days.reduce((total, day) => total + (day.manualByGoalId[goalId] ?? 0), 0);
  }
  const metric = METRICS[metricKey];
  if (metric.aggregation === "latest") {
    for (let i = days.length - 1; i >= 0; i -= 1) {
      const value = metric.select(days[i], metricParam);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  }
  return days.reduce((total, day) => total + (metric.select(day, metricParam) ?? 0), 0);
}
