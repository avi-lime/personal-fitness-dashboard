import "server-only";
import { addDays, eachDay, type LocalDate } from "@/lib/date";
import {
  computeAdherence,
  computeStreak,
  reviewHighlights,
  summarizePeriod,
  type GoalAdherence,
  type PeriodSummary,
  type ReviewHighlights,
} from "@/lib/aggregate";
import { computeGoalProgress, effectiveTarget, sortGoals, type GoalLike } from "@/lib/goals";
import { emptyDayFacts, type DayFacts } from "@/lib/metrics";
import { densify, loadDayFacts } from "./day";
import { listGoals, toGoalLike } from "./goals";
import { listNotes } from "./notes";
import type { Note } from "@/db/schema";

export interface WeeklySummary {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  summary: PeriodSummary;
  days: DayFacts[];
  adherence: GoalAdherence[];
  streaks: Array<{ goalId: string; name: string; streak: number }>;
  highlights: ReviewHighlights;
  notes: Note[];
  goals: GoalLike[];
}

/**
 * Weekly aggregates. Daily progress is computed with the same
 * `computeGoalProgress` the dashboard uses, so "met" means the same thing here.
 */
export async function getWeeklySummary(
  userId: string,
  weekStart: LocalDate,
  options: { includeNotes?: boolean } = {},
): Promise<WeeklySummary> {
  const weekEnd = addDays(weekStart, 6);
  const dates = eachDay(weekStart, weekEnd);

  const [factsMap, goalRows, notes] = await Promise.all([
    loadDayFacts(userId, weekStart, weekEnd),
    listGoals(userId),
    options.includeNotes === false ? Promise.resolve<Note[]>([]) : listNotes(userId, 20),
  ]);

  const dense = densify(factsMap, dates);
  const days = dates.map((date) => dense.get(date) ?? emptyDayFacts(date));
  const goals = sortGoals(goalRows.map(toGoalLike)).filter((goal) => goal.active);

  const adherence: GoalAdherence[] = [];
  const streaks: Array<{ goalId: string; name: string; streak: number }> = [];

  for (const goal of goals) {
    // Tracking-only goals (no target) have nothing to adhere to.
    if (effectiveTarget(goal) === null) continue;
    if (goal.period === "daily") {
      const perDay = days.map((day) => computeGoalProgress(goal, [day]));
      adherence.push(computeAdherence(goal, perDay));
      streaks.push({ goalId: goal.id, name: goal.name, streak: computeStreak(perDay) });
    } else {
      const whole = computeGoalProgress(goal, days);
      adherence.push(computeAdherence(goal, [whole]));
    }
  }

  const summary = summarizePeriod(days, weekStart, weekEnd);
  const weekNotes = notes.filter((note) => note.localDate >= weekStart && note.localDate <= weekEnd);

  return {
    weekStart,
    weekEnd,
    summary,
    days,
    adherence,
    streaks,
    highlights: reviewHighlights(adherence, summary.weight),
    notes: weekNotes,
    goals,
  };
}

/** Day-by-day facts for the history page. */
export async function getHistory(
  userId: string,
  startDate: LocalDate,
  endDate: LocalDate,
): Promise<DayFacts[]> {
  const dates = eachDay(startDate, endDate);
  const dense = densify(await loadDayFacts(userId, startDate, endDate), dates);
  return dates.map((date) => dense.get(date) ?? emptyDayFacts(date));
}
