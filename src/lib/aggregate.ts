import { type LocalDate } from "./date";
import { round, type GoalLike, type GoalProgress } from "./goals";
import type { DayFacts } from "./metrics";

/** Rolling statistics for a set of weigh-ins. */
export interface WeightStats {
  latest: number | null;
  latestDate: LocalDate | null;
  sevenDayAverage: number | null;
  changeThisWeek: number | null;
  changeSinceStart: number | null;
  first: number | null;
  firstDate: LocalDate | null;
}

export interface WeightPoint {
  date: LocalDate;
  weightKg: number;
}

export function computeWeightStats(points: WeightPoint[], today: LocalDate): WeightStats {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length === 0) {
    return {
      latest: null,
      latestDate: null,
      sevenDayAverage: null,
      changeThisWeek: null,
      changeSinceStart: null,
      first: null,
      firstDate: null,
    };
  }
  const last = sorted[sorted.length - 1];
  const first = sorted[0];

  const windowStart = shift(today, -6);
  const inWindow = sorted.filter((p) => p.date >= windowStart && p.date <= today);
  const sevenDayAverage =
    inWindow.length > 0 ? round(inWindow.reduce((s, p) => s + p.weightKg, 0) / inWindow.length) : null;

  const weekAgoStart = shift(today, -13);
  const previousWindow = sorted.filter((p) => p.date >= weekAgoStart && p.date < windowStart);
  const previousAverage =
    previousWindow.length > 0
      ? previousWindow.reduce((s, p) => s + p.weightKg, 0) / previousWindow.length
      : null;

  return {
    latest: round(last.weightKg),
    latestDate: last.date,
    sevenDayAverage,
    changeThisWeek:
      sevenDayAverage !== null && previousAverage !== null
        ? round(sevenDayAverage - previousAverage)
        : null,
    changeSinceStart: round(last.weightKg - first.weightKg),
    first: round(first.weightKg),
    firstDate: first.date,
  };
}

function shift(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export interface PeriodSummary {
  start: LocalDate;
  end: LocalDate;
  days: number;
  /** Days that carry at least one logged event. */
  daysWithData: number;
  averages: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    waterMl: number;
    sleepHours: number;
  };
  totals: {
    calories: number;
    protein: number;
    waterMl: number;
    workouts: number;
  };
  weight: WeightStats;
}

function hasData(day: DayFacts): boolean {
  return (
    day.calories > 0 ||
    day.protein > 0 ||
    day.waterMl > 0 ||
    day.sleepHours > 0 ||
    day.workoutCount > 0 ||
    day.weightKg !== null ||
    Object.keys(day.manualByGoalId).length > 0
  );
}

/**
 * Averages are taken over days *with data* so a half-logged week is not
 * misreported as a bad week. `days` counts the whole window.
 */
export function summarizePeriod(days: DayFacts[], start: LocalDate, end: LocalDate): PeriodSummary {
  const populated = days.filter(hasData);
  const divisor = populated.length || 1;
  const sum = (pick: (d: DayFacts) => number) => days.reduce((total, d) => total + pick(d), 0);
  const avg = (pick: (d: DayFacts) => number) => round(sum(pick) / divisor);

  const weightPoints: WeightPoint[] = days
    .filter((d): d is DayFacts & { weightKg: number } => d.weightKg !== null)
    .map((d) => ({ date: d.date, weightKg: d.weightKg }));

  return {
    start,
    end,
    days: days.length,
    daysWithData: populated.length,
    averages: {
      calories: avg((d) => d.calories),
      protein: avg((d) => d.protein),
      carbs: avg((d) => d.carbs),
      fat: avg((d) => d.fat),
      waterMl: avg((d) => d.waterMl),
      sleepHours: avg((d) => d.sleepHours),
    },
    totals: {
      calories: round(sum((d) => d.calories)),
      protein: round(sum((d) => d.protein)),
      waterMl: round(sum((d) => d.waterMl)),
      workouts: sum((d) => d.workoutCount),
    },
    weight: computeWeightStats(weightPoints, end),
  };
}

export interface GoalAdherence {
  goalId: string;
  name: string;
  unit: string | null;
  /** Days in the window on which the goal was met. */
  daysMet: number;
  daysTracked: number;
  adherence: number;
  average: number;
  target: number | null;
}

/**
 * Per-goal adherence across a window. `progressPerDay` supplies the progress a
 * goal had on each individual day, which the caller computes with
 * `computeGoalProgress` so there is exactly one implementation of the maths.
 */
export function computeAdherence(
  goal: GoalLike,
  progressPerDay: GoalProgress[],
): GoalAdherence {
  const daysTracked = progressPerDay.length;
  const daysMet = progressPerDay.filter((p) => p.status === "complete").length;
  const average =
    daysTracked > 0 ? round(progressPerDay.reduce((s, p) => s + p.current, 0) / daysTracked) : 0;
  return {
    goalId: goal.id,
    name: goal.name,
    unit: goal.unit,
    daysMet,
    daysTracked,
    adherence: daysTracked > 0 ? round(daysMet / daysTracked, 4) : 0,
    average,
    target: progressPerDay[0]?.target ?? goal.targetValue,
  };
}

/** Consecutive days ending at the most recent day on which the goal was met. */
export function computeStreak(progressPerDay: GoalProgress[]): number {
  let streak = 0;
  for (let i = progressPerDay.length - 1; i >= 0; i -= 1) {
    if (progressPerDay[i].status === "complete") streak += 1;
    else break;
  }
  return streak;
}

export interface ReviewHighlights {
  strongest: GoalAdherence | null;
  biggestMiss: GoalAdherence | null;
  watch: string | null;
}

/** Picks the headline observations for the weekly review. */
export function reviewHighlights(
  adherence: GoalAdherence[],
  weight: WeightStats,
): ReviewHighlights {
  const tracked = adherence.filter((a) => a.daysTracked > 0 && a.target !== null);
  const sorted = [...tracked].sort((a, b) => b.adherence - a.adherence);
  const strongest = sorted[0] ?? null;
  const biggestMiss = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  let watch: string | null = null;
  if (weight.changeThisWeek !== null && Math.abs(weight.changeThisWeek) >= 0.3) {
    watch =
      weight.changeThisWeek > 0
        ? `7-day average weight is up ${weight.changeThisWeek} kg on the previous week.`
        : `7-day average weight is down ${Math.abs(weight.changeThisWeek)} kg on the previous week.`;
  } else if (biggestMiss && biggestMiss.adherence < 0.5) {
    watch = `${biggestMiss.name} was met on ${biggestMiss.daysMet} of ${biggestMiss.daysTracked} days.`;
  }

  return { strongest, biggestMiss: biggestMiss?.goalId === strongest?.goalId ? null : biggestMiss, watch };
}
