import "server-only";
import { and, asc, between, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import {
  foodLogs,
  goalEntries,
  sleepEntries,
  tasks,
  timeEntries,
  waterLogs,
  weightEntries,
  workouts,
} from "@/db/schema";
import { emptyDayFacts, type DayFacts } from "@/lib/metrics";
import { hoursBetween, type LocalDate } from "@/lib/date";
import { round } from "@/lib/goals";

/**
 * Builds `DayFacts` for an inclusive date range straight from the event tables.
 * Daily totals are never stored: this is the single place they are derived, so
 * the dashboard, the weekly review and the MCP tools can never disagree.
 */
export async function loadDayFacts(
  userId: string,
  startDate: LocalDate,
  endDate: LocalDate,
): Promise<Map<LocalDate, DayFacts>> {
  const [food, water, weights, sleep, sessions, entries, time, doneTasks] = await Promise.all([
    db
      .select({
        localDate: foodLogs.localDate,
        calories: foodLogs.calories,
        proteinG: foodLogs.proteinG,
        carbsG: foodLogs.carbsG,
        fatG: foodLogs.fatG,
      })
      .from(foodLogs)
      .where(and(eq(foodLogs.userId, userId), between(foodLogs.localDate, startDate, endDate))),
    db
      .select({ localDate: waterLogs.localDate, milliliters: waterLogs.milliliters })
      .from(waterLogs)
      .where(and(eq(waterLogs.userId, userId), between(waterLogs.localDate, startDate, endDate))),
    db
      .select({
        localDate: weightEntries.localDate,
        weightKg: weightEntries.weightKg,
        occurredAt: weightEntries.occurredAt,
      })
      .from(weightEntries)
      .where(
        and(eq(weightEntries.userId, userId), between(weightEntries.localDate, startDate, endDate)),
      )
      .orderBy(asc(weightEntries.occurredAt)),
    db
      .select({
        localDate: sleepEntries.localDate,
        startAt: sleepEntries.startAt,
        endAt: sleepEntries.endAt,
      })
      .from(sleepEntries)
      .where(
        and(eq(sleepEntries.userId, userId), between(sleepEntries.localDate, startDate, endDate)),
      ),
    db
      .select({ localDate: workouts.localDate })
      .from(workouts)
      .where(
        and(
          eq(workouts.userId, userId),
          between(workouts.localDate, startDate, endDate),
          isNotNull(workouts.completedAt),
        ),
      ),
    db
      .select({
        localDate: goalEntries.localDate,
        goalId: goalEntries.goalId,
        value: goalEntries.value,
      })
      .from(goalEntries)
      .where(
        and(eq(goalEntries.userId, userId), between(goalEntries.localDate, startDate, endDate)),
      ),
    db
      .select({
        localDate: timeEntries.localDate,
        category: timeEntries.category,
        durationMinutes: timeEntries.durationMinutes,
      })
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, userId),
          between(timeEntries.localDate, startDate, endDate),
          isNotNull(timeEntries.endAt),
        ),
      ),
    db
      .select({ completedOn: tasks.completedOn })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          eq(tasks.status, "done"),
          between(tasks.completedOn, startDate, endDate),
        ),
      ),
  ]);

  const map = new Map<LocalDate, DayFacts>();
  const factsFor = (date: LocalDate): DayFacts => {
    let facts = map.get(date);
    if (!facts) {
      facts = emptyDayFacts(date);
      map.set(date, facts);
    }
    return facts;
  };

  for (const row of food) {
    const facts = factsFor(row.localDate);
    facts.calories += row.calories ?? 0;
    facts.protein += row.proteinG ?? 0;
    facts.carbs += row.carbsG ?? 0;
    facts.fat += row.fatG ?? 0;
  }
  for (const row of water) factsFor(row.localDate).waterMl += row.milliliters;
  for (const row of weights) factsFor(row.localDate).weightKg = row.weightKg;
  for (const row of sleep) {
    factsFor(row.localDate).sleepHours += hoursBetween(row.startAt, row.endAt);
  }
  for (const row of sessions) factsFor(row.localDate).workoutCount += 1;
  for (const row of entries) {
    const facts = factsFor(row.localDate);
    facts.manualByGoalId[row.goalId] = (facts.manualByGoalId[row.goalId] ?? 0) + row.value;
  }
  for (const row of time) {
    const facts = factsFor(row.localDate);
    facts.minutesByCategory[row.category] =
      (facts.minutesByCategory[row.category] ?? 0) + (row.durationMinutes ?? 0);
  }
  for (const row of doneTasks) {
    if (row.completedOn) factsFor(row.completedOn).tasksCompleted += 1;
  }

  for (const facts of map.values()) {
    facts.calories = round(facts.calories);
    facts.protein = round(facts.protein);
    facts.carbs = round(facts.carbs);
    facts.fat = round(facts.fat);
    facts.sleepHours = round(facts.sleepHours);
  }

  return map;
}

/** Fills gaps so callers always get one entry per date in the range. */
export function densify(
  map: Map<LocalDate, DayFacts>,
  dates: LocalDate[],
): Map<LocalDate, DayFacts> {
  const dense = new Map<LocalDate, DayFacts>();
  for (const date of dates) dense.set(date, map.get(date) ?? emptyDayFacts(date));
  return dense;
}

/** Every weigh-in in a range, oldest first. */
export async function loadWeightPoints(userId: string, startDate: LocalDate, endDate: LocalDate) {
  return db
    .select({
      id: weightEntries.id,
      date: weightEntries.localDate,
      weightKg: weightEntries.weightKg,
      note: weightEntries.note,
      occurredAt: weightEntries.occurredAt,
    })
    .from(weightEntries)
    .where(
      and(eq(weightEntries.userId, userId), between(weightEntries.localDate, startDate, endDate)),
    )
    .orderBy(asc(weightEntries.occurredAt));
}
