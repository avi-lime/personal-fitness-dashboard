import type { GoalType, MetricKey } from "./domain";
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
  };
}

/**
 * How a metric combines across several days.
 * - `sum`    : add the daily values (calories, water, …)
 * - `latest` : take the most recent non-null value (body weight)
 */
export type MetricAggregation = "sum" | "latest";

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  /** Unit suggested when a goal is created against this metric. */
  defaultUnit: string;
  /** Goal type suggested when a goal is created against this metric. */
  suggestedType: GoalType;
  aggregation: MetricAggregation;
  select: (facts: DayFacts) => number | null;
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
};

export const METRIC_LIST: MetricDefinition[] = Object.values(METRICS);

export function getMetric(key: MetricKey): MetricDefinition {
  return METRICS[key];
}

export function isMetricKey(value: string): value is MetricKey {
  return Object.prototype.hasOwnProperty.call(METRICS, value);
}

/**
 * Resolves a metric (or a manual goal) across one or more days.
 * Returns `null` only for `latest` metrics that have no data at all.
 */
export function resolveMetric(
  metricKey: MetricKey | null,
  goalId: string,
  days: DayFacts[],
): number | null {
  if (metricKey === null) {
    return days.reduce((total, day) => total + (day.manualByGoalId[goalId] ?? 0), 0);
  }
  const metric = METRICS[metricKey];
  if (metric.aggregation === "latest") {
    for (let i = days.length - 1; i >= 0; i -= 1) {
      const value = metric.select(days[i]);
      if (value !== null && value !== undefined) return value;
    }
    return null;
  }
  return days.reduce((total, day) => total + (metric.select(day) ?? 0), 0);
}
