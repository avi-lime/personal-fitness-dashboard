import "server-only";
import {
  addDays,
  eachDay,
  lastNDays,
  startOfMonth,
  startOfWeek,
  toLocalDate,
  type LocalDate,
} from "@/lib/date";
import { computeAllGoalProgress, sortGoals, type GoalLike, type GoalProgress } from "@/lib/goals";
import { checklistCompletion } from "@/lib/goals";
import { resolveNextAction, type NextAction } from "@/lib/next-action";
import { computeWeightStats, summarizePeriod, type PeriodSummary, type WeightStats } from "@/lib/aggregate";
import type { DayFacts } from "@/lib/metrics";
import { emptyDayFacts } from "@/lib/metrics";
import { densify, loadDayFacts } from "./day";
import { listGoals, toGoalLike } from "./goals";
import { listWorkoutsForDate, type WorkoutView } from "./workouts";
import { listNotesForDate } from "./notes";
import type { Note } from "@/db/schema";

export interface TodaySnapshot {
  date: LocalDate;
  timezone: string;
  facts: DayFacts;
  goals: GoalLike[];
  progress: GoalProgress[];
  progressById: Map<string, GoalProgress>;
  nextAction: NextAction;
  checklist: number;
  workouts: WorkoutView[];
  notes: Note[];
  weight: WeightStats;
  weightSeries: Array<{ date: LocalDate; weightKg: number }>;
  week: PeriodSummary;
  weekDays: DayFacts[];
}

/**
 * Everything the dashboard, monitor mode and `get_today` need, computed once
 * from the event log. Loading a 35-day window covers weekly and monthly goal
 * periods plus the trailing weight average without a second round trip.
 */
export async function getTodaySnapshot(
  userId: string,
  timezone: string,
  today: LocalDate = toLocalDate(new Date(), timezone),
): Promise<TodaySnapshot> {
  const monthStart = startOfMonth(today);
  const windowStart = monthStart < addDays(today, -34) ? monthStart : addDays(today, -34);

  const [factsMap, goalRows, workouts, notes] = await Promise.all([
    loadDayFacts(userId, windowStart, today),
    listGoals(userId),
    listWorkoutsForDate(userId, today),
    listNotesForDate(userId, today),
  ]);

  const dense = densify(factsMap, eachDay(windowStart, today));
  const goals = sortGoals(goalRows.map(toGoalLike));
  const activeGoals = goals.filter((goal) => goal.active);
  const progress = computeAllGoalProgress(activeGoals, today, dense);
  const progressById = new Map(progress.map((entry) => [entry.goalId, entry]));

  const weightSeries = [...dense.values()]
    .filter((day): day is DayFacts & { weightKg: number } => day.weightKg !== null)
    .map((day) => ({ date: day.date, weightKg: day.weightKg }));

  const weekDates = lastNDays(today, 7);
  const weekDays = weekDates.map((date) => dense.get(date) ?? emptyDayFacts(date));

  return {
    date: today,
    timezone,
    facts: dense.get(today) ?? emptyDayFacts(today),
    goals,
    progress,
    progressById,
    nextAction: resolveNextAction({ goals: activeGoals, progressById }),
    checklist: checklistCompletion(activeGoals, progressById),
    workouts,
    notes,
    weight: computeWeightStats(weightSeries, today),
    weightSeries,
    week: summarizePeriod(weekDays, weekDates[0], today),
    weekDays,
  };
}

export function currentWeekStart(timezone: string): LocalDate {
  return startOfWeek(toLocalDate(new Date(), timezone));
}
