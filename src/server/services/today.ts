import "server-only";
import {
  addDays,
  eachDay,
  lastNDays,
  startOfMonth,
  startOfWeek,
  toLocalDate,
  toLocalTime,
  type LocalDate,
} from "@/lib/date";
import { currentBlock, nextBlock } from "@/lib/plan";
import { round } from "@/lib/goals";
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
import { listTasks, countTasks, type TaskCounts } from "./tasks";
import { getRunningTimer } from "./time";
import { listBlocks } from "./plan";
import { listApplications } from "./career";
import { listBills } from "./money";
import { getProfileFor } from "./profile";
import type { Application, Bill, Note, Task, TimeBlock, TimeEntry } from "@/db/schema";

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
  tasks: TaskCounts & { items: Task[] };
  plan: { blocks: TimeBlock[]; now: string; current: TimeBlock | null; next: TimeBlock | null };
  time: { running: TimeEntry | null; minutesByCategory: Record<string, number> };
  money: { currency: string; spentToday: number; spentThisWeek: number; bills: Bill[] };
  career: { active: Application[]; nextStepsDue: Application[] };
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

  const [factsMap, goalRows, workouts, notes, taskRows, running, blocks, apps, pendingBills, profile] =
    await Promise.all([
      loadDayFacts(userId, windowStart, today),
      listGoals(userId),
      listWorkoutsForDate(userId, today),
      listNotesForDate(userId, today),
      listTasks(userId, { status: "todo", limit: 100 }),
      getRunningTimer(userId),
      listBlocks(userId, today),
      listApplications(userId),
      listBills(userId, "pending"),
      getProfileFor(userId),
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
  const facts = dense.get(today) ?? emptyDayFacts(today);
  const now = toLocalTime(new Date(), timezone);
  const bills = pendingBills.filter((bill) => bill.dueDate <= addDays(today, 30));
  const spend = (day: DayFacts) => Object.values(day.spendByCategory).reduce((sum, v) => sum + v, 0);
  const weekStart = startOfWeek(today);

  const nextAction = resolveNextAction({
    goals: activeGoals,
    progressById,
    today,
    nowTime: now,
    tasks: taskRows,
    bills: pendingBills,
    currency: profile.currency,
    blocks,
    applications: apps.filter((app) => app.stage !== "rejected"),
  });

  return {
    date: today,
    timezone,
    facts,
    goals,
    progress,
    progressById,
    nextAction,
    checklist: checklistCompletion(activeGoals, progressById),
    workouts,
    notes,
    weight: computeWeightStats(weightSeries, today),
    weightSeries,
    week: summarizePeriod(weekDays, weekDates[0], today),
    weekDays,
    tasks: { ...countTasks(taskRows, today), items: taskRows },
    plan: { blocks, now, current: currentBlock(blocks, now), next: nextBlock(blocks, now) },
    time: { running, minutesByCategory: facts.minutesByCategory },
    money: {
      currency: profile.currency,
      spentToday: round(spend(facts)),
      spentThisWeek: round(
        [...dense.entries()].filter(([date]) => date >= weekStart).reduce((sum, [, day]) => sum + spend(day), 0),
      ),
      bills,
    },
    career: {
      active: apps.filter((app) => app.stage !== "rejected"),
      nextStepsDue: apps.filter((app) => app.nextStepDate !== null && app.nextStepDate <= today),
    },
  };
}

export function currentWeekStart(timezone: string): LocalDate {
  return startOfWeek(toLocalDate(new Date(), timezone));
}
