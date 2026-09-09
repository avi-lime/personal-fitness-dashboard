import "server-only";
import { z } from "zod";
import type { McpContext } from "@/mcp/context";
import { getTodaySnapshot } from "@/server/services/today";
import { getWeeklySummary } from "@/server/services/summary";
import { listFoodLogs } from "@/server/services/food";
import { sumNutrition } from "@/lib/nutrition";
import { listWorkoutsForDate, previousPerformance } from "@/server/services/workouts";
import { getGoal as loadGoal, listGoals, toGoalLike } from "@/server/services/goals";
import { loadWeightPoints } from "@/server/services/day";
import { computeGoalProgress, periodWindow, sortGoals } from "@/lib/goals";
import { computeWeightStats } from "@/lib/aggregate";
import { densify, loadDayFacts } from "@/server/services/day";
import { eachDay, startOfWeek } from "@/lib/date";
import { METRICS } from "@/lib/metrics";
import type {
  getFoodLogInput,
  getGoalInput,
  getWeeklySummaryInput,
  getWeightHistoryInput,
  getWorkoutInput,
} from "@/mcp/schemas";

/**
 * Read tools. Each returns a small, flat object: enough for a model to answer a
 * question without shipping raw database rows.
 */

export async function getToday(ctx: McpContext) {
  const snapshot = await getTodaySnapshot(ctx.userId, ctx.timezone, ctx.today);

  return {
    date: snapshot.date,
    timezone: snapshot.timezone,
    goals: snapshot.goals
      .filter((goal) => goal.active)
      .map((goal) => {
        const progress = snapshot.progressById.get(goal.id);
        return {
          id: goal.id,
          name: goal.name,
          current: progress?.current ?? 0,
          target: progress?.target ?? null,
          unit: goal.unit,
          period: goal.period,
          progress: progress?.progress ?? 0,
          status: progress?.status ?? "not_started",
        };
      }),
    totals: {
      calories: snapshot.facts.calories,
      protein: snapshot.facts.protein,
      carbs: snapshot.facts.carbs,
      fat: snapshot.facts.fat,
      waterMl: snapshot.facts.waterMl,
      sleepHours: snapshot.facts.sleepHours,
      workouts: snapshot.facts.workoutCount,
      weightKg: snapshot.facts.weightKg,
    },
    workout: snapshot.workouts[0]
      ? {
          id: snapshot.workouts[0].id,
          name: snapshot.workouts[0].name,
          completed: snapshot.workouts[0].completedAt !== null,
          exercises: snapshot.workouts[0].exercises.length,
        }
      : null,
    weight: {
      latest: snapshot.weight.latest,
      sevenDayAverage: snapshot.weight.sevenDayAverage,
      changeThisWeek: snapshot.weight.changeThisWeek,
    },
    checklist: {
      completedFraction: snapshot.checklist,
    },
    nextAction: {
      type: snapshot.nextAction.type,
      goalId: snapshot.nextAction.goalId,
      label: snapshot.nextAction.label,
    },
  };
}

export async function getGoals(ctx: McpContext) {
  const goals = sortGoals((await listGoals(ctx.userId)).map(toGoalLike));
  return {
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      description: goal.description,
      type: goal.type,
      unit: goal.unit,
      targetValue: goal.targetValue,
      period: goal.period,
      metricKey: goal.metricKey,
      metricLabel: goal.metricKey ? METRICS[goal.metricKey].label : "Manual entries",
      active: goal.active,
      visibleOnDashboard: goal.visibleOnDashboard,
      showInChecklist: goal.showInChecklist,
      sortOrder: goal.sortOrder,
    })),
  };
}

export async function getGoalWithProgress(
  ctx: McpContext,
  args: z.infer<typeof getGoalInput>,
) {
  const row = await loadGoal(ctx.userId, args.goalId);
  if (!row) return null;

  const goal = toGoalLike(row);
  const window = periodWindow(goal.period, ctx.today, row.createdAt.toISOString().slice(0, 10));
  const dates = eachDay(window.start, window.end);
  const facts = densify(await loadDayFacts(ctx.userId, window.start, window.end), dates);
  const progress = computeGoalProgress(goal, dates.map((date) => facts.get(date)!));

  return {
    goal: {
      id: goal.id,
      name: goal.name,
      description: goal.description,
      type: goal.type,
      unit: goal.unit,
      targetValue: goal.targetValue,
      period: goal.period,
      metricKey: goal.metricKey,
      active: goal.active,
      visibleOnDashboard: goal.visibleOnDashboard,
      showInChecklist: goal.showInChecklist,
    },
    period: window,
    progress: {
      current: progress.current,
      target: progress.target,
      progress: progress.progress,
      remaining: progress.remaining,
      status: progress.status,
    },
  };
}

export async function getFoodLog(ctx: McpContext, args: z.infer<typeof getFoodLogInput>) {
  const date = args.date ?? ctx.today;
  const entries = await listFoodLogs(ctx.userId, date);
  return {
    date,
    totals: sumNutrition(entries),
    entries: entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      calories: entry.calories,
      proteinG: entry.proteinG,
      carbsG: entry.carbsG,
      fatG: entry.fatG,
      quantity: entry.quantity,
      unit: entry.unit,
      mealType: entry.mealType,
      loggedAt: entry.occurredAt.toISOString(),
      notes: entry.notes,
    })),
  };
}

export async function getWorkout(ctx: McpContext, args: z.infer<typeof getWorkoutInput>) {
  const date = args.date ?? ctx.today;
  const workouts = await listWorkoutsForDate(ctx.userId, date);

  const detailed = await Promise.all(
    workouts.map(async (workout) => ({
      id: workout.id,
      name: workout.name,
      date: workout.date,
      completed: workout.completedAt !== null,
      notes: workout.notes,
      exercises: await Promise.all(
        workout.exercises.map(async (exercise) => {
          const previous = await previousPerformance(
            ctx.userId,
            exercise.name,
            workout.date,
            workout.id,
          );
          return {
            name: exercise.name,
            muscleGroup: exercise.muscleGroup,
            sets: exercise.sets.map((set) => ({
              reps: set.reps,
              weightKg: set.weightKg,
              durationSeconds: set.durationSeconds,
              rpe: set.rpe,
              completed: set.completed,
            })),
            previousSession: previous
              ? {
                  date: previous.date,
                  volume: previous.volume,
                  bestSet: previous.best
                    ? { reps: previous.best.reps, weightKg: previous.best.weightKg }
                    : null,
                }
              : null,
          };
        }),
      ),
    })),
  );

  return { date, workouts: detailed };
}

export async function getWeightHistory(
  ctx: McpContext,
  args: z.infer<typeof getWeightHistoryInput>,
) {
  const points = await loadWeightPoints(ctx.userId, args.startDate, args.endDate);
  const series = points.map((point) => ({ date: point.date, weightKg: point.weightKg }));
  return {
    startDate: args.startDate,
    endDate: args.endDate,
    stats: computeWeightStats(series, args.endDate),
    entries: points.map((point) => ({
      id: point.id,
      date: point.date,
      weightKg: point.weightKg,
      note: point.note,
      recordedAt: point.occurredAt.toISOString(),
    })),
  };
}

export async function getWeeklySummaryTool(
  ctx: McpContext,
  args: z.infer<typeof getWeeklySummaryInput>,
) {
  const weekStart = startOfWeek(args.weekStart ?? ctx.today);
  const review = await getWeeklySummary(ctx.userId, weekStart, { includeNotes: false });

  return {
    weekStart: review.weekStart,
    weekEnd: review.weekEnd,
    daysWithData: review.summary.daysWithData,
    averages: {
      calories: review.summary.averages.calories,
      protein: review.summary.averages.protein,
      carbs: review.summary.averages.carbs,
      fat: review.summary.averages.fat,
      waterMl: review.summary.averages.waterMl,
      sleepHours: review.summary.averages.sleepHours,
    },
    workouts: review.summary.totals.workouts,
    weight: review.summary.weight,
    goalAdherence: review.adherence.map((entry) => ({
      goalId: entry.goalId,
      name: entry.name,
      unit: entry.unit,
      target: entry.target,
      average: entry.average,
      daysMet: entry.daysMet,
      daysTracked: entry.daysTracked,
      adherence: entry.adherence,
    })),
    streaks: review.streaks.filter((entry) => entry.streak > 0),
    highlights: {
      strongest: review.highlights.strongest?.name ?? null,
      biggestMiss: review.highlights.biggestMiss?.name ?? null,
      watch: review.highlights.watch,
    },
  };
}
