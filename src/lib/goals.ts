import type { AreaKey, GoalPeriod, GoalStatus, GoalType, MetricKey } from "./domain";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  type LocalDate,
} from "./date";
import { resolveMetric, type DayFacts } from "./metrics";

/** The goal fields the calculation layer needs. Mirrors the `goals` table. */
export interface GoalLike {
  id: string;
  name: string;
  description: string | null;
  type: GoalType;
  unit: string | null;
  targetValue: number | null;
  period: GoalPeriod;
  metricKey: MetricKey | null;
  /** Parameter for metrics that need one (e.g. the category for time tracked). */
  metricParam: string | null;
  area: AreaKey | null;
  active: boolean;
  visibleOnDashboard: boolean;
  showInChecklist: boolean;
  sortOrder: number;
  color: string | null;
  icon: string | null;
}

export interface GoalProgress {
  goalId: string;
  name: string;
  type: GoalType;
  period: GoalPeriod;
  unit: string | null;
  /** Current value for the goal's period, always a number for display. */
  current: number;
  /** Configured target, or null for goals that only track a value. */
  target: number | null;
  /** 0..1, clamped. 0 when there is no target. */
  progress: number;
  /** `progress` as a whole percentage, clamped to 0..100. */
  percent: number;
  remaining: number | null;
  status: GoalStatus;
  /** True when the goal has no target and merely displays a value. */
  trackingOnly: boolean;
  /** False when the underlying metric has no reading at all for the period. */
  hasValue: boolean;
}

/** Inclusive date window a goal's period covers, relative to `date`. */
export function periodWindow(
  period: GoalPeriod,
  date: LocalDate,
  createdOn?: LocalDate,
): { start: LocalDate; end: LocalDate } {
  switch (period) {
    case "daily":
      return { start: date, end: date };
    case "weekly":
      return { start: startOfWeek(date), end: endOfWeek(date) };
    case "monthly":
      return { start: startOfMonth(date), end: endOfMonth(date) };
    case "one_time":
      return { start: createdOn ?? addDays(date, -365), end: date };
  }
}

/** Boolean and count goals default to a target of 1 when none is configured. */
export function effectiveTarget(goal: GoalLike): number | null {
  if (goal.targetValue !== null && goal.targetValue !== undefined) return goal.targetValue;
  if (goal.type === "boolean") return 1;
  return null;
}

function statusFor(current: number, target: number | null): GoalStatus {
  if (target === null || target <= 0) return current > 0 ? "in_progress" : "not_started";
  if (current >= target) return "complete";
  if (current > 0) return "in_progress";
  return "not_started";
}

export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Computes a goal's progress from the day facts covering its period.
 * `days` must already be filtered to the goal's period window.
 */
export function computeGoalProgress(goal: GoalLike, days: DayFacts[]): GoalProgress {
  const raw = resolveMetric(goal.metricKey, goal.id, days, goal.metricParam);
  const current = round(raw ?? 0);
  const target = effectiveTarget(goal);
  const trackingOnly = target === null;
  const progress = target && target > 0 ? Math.min(1, Math.max(0, current / target)) : 0;
  const remaining = target === null ? null : round(Math.max(0, target - current));

  return {
    goalId: goal.id,
    name: goal.name,
    type: goal.type,
    period: goal.period,
    unit: goal.unit,
    current,
    target: target === null ? null : round(target),
    progress: round(progress, 4),
    percent: Math.round(progress * 100),
    remaining,
    status: statusFor(current, target),
    trackingOnly,
    hasValue: raw !== null,
  };
}

/**
 * Computes progress for many goals at once. `daysByDate` should cover the
 * widest period in use (a month for monthly goals).
 */
export function computeAllGoalProgress(
  goals: GoalLike[],
  date: LocalDate,
  daysByDate: Map<LocalDate, DayFacts>,
): GoalProgress[] {
  return goals.map((goal) => {
    const { start, end } = periodWindow(goal.period, date);
    const days: DayFacts[] = [];
    for (const [key, facts] of daysByDate) {
      if (key >= start && key <= end) days.push(facts);
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    return computeGoalProgress(goal, days);
  });
}

/** Share of checklist goals that are complete, 0..1. */
export function checklistCompletion(
  goals: GoalLike[],
  progressById: Map<string, GoalProgress>,
): number {
  const relevant = goals.filter((g) => g.showInChecklist && g.active);
  if (relevant.length === 0) return 0;
  const done = relevant.filter((g) => progressById.get(g.id)?.status === "complete").length;
  return round(done / relevant.length, 4);
}

export function sortGoals<T extends { sortOrder: number; name: string }>(goals: T[]): T[] {
  return [...goals].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
