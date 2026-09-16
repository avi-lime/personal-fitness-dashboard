import "server-only";
import { formatLongDate, type LocalDate } from "@/lib/date";
import { getTodaySnapshot } from "./today";

/** Compact payload for monitor mode — small enough to poll every minute. */
export interface MonitorPayload {
  date: LocalDate;
  dateLabel: string;
  timezone: string;
  generatedAt: string;
  nextAction: { label: string; detail: string | null; type: string };
  checklist: { done: number; total: number; fraction: number };
  goals: Array<{
    id: string;
    name: string;
    current: number;
    target: number | null;
    unit: string | null;
    percent: number;
    status: string;
    hasValue: boolean;
    trackingOnly: boolean;
  }>;
  workout: { name: string; completed: boolean; setsDone: number; setsTotal: number } | null;
  weight: { latest: number | null; sevenDayAverage: number | null; changeThisWeek: number | null };
  week: {
    calories: number[];
    protein: number[];
    waterMl: number[];
    sleepHours: number[];
    averages: { calories: number; protein: number; waterMl: number; sleepHours: number };
    workouts: number;
  };
  plan: {
    total: number;
    done: number;
    current: { label: string; endTime: string } | null;
    next: { label: string; startTime: string } | null;
  };
  tasks: { open: number; overdue: number; next: string | null };
  money: {
    currency: string;
    spentToday: number;
    nextBill: { name: string; amount: number; dueDate: string } | null;
  };
  timer: { category: string; label: string | null; startedAt: string } | null;
}

export async function buildMonitorPayload(
  userId: string,
  timezone: string,
): Promise<MonitorPayload> {
  const snapshot = await getTodaySnapshot(userId, timezone);

  const dashboardGoals = snapshot.goals.filter((goal) => goal.active && goal.visibleOnDashboard);
  const checklistGoals = snapshot.goals.filter((goal) => goal.active && goal.showInChecklist);
  const done = checklistGoals.filter(
    (goal) => snapshot.progressById.get(goal.id)?.status === "complete",
  ).length;

  const workout = snapshot.workouts[0] ?? null;
  const setsTotal = workout
    ? workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)
    : 0;
  const setsDone = workout
    ? workout.exercises.reduce(
        (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
        0,
      )
    : 0;

  return {
    date: snapshot.date,
    dateLabel: formatLongDate(snapshot.date, timezone),
    timezone,
    generatedAt: new Date().toISOString(),
    nextAction: {
      label: snapshot.nextAction.label,
      detail: snapshot.nextAction.detail,
      type: snapshot.nextAction.type,
    },
    checklist: { done, total: checklistGoals.length, fraction: snapshot.checklist },
    goals: dashboardGoals.flatMap((goal) => {
      const progress = snapshot.progressById.get(goal.id);
      if (!progress) return [];
      return [
        {
          id: goal.id,
          name: goal.name,
          current: progress.current,
          target: progress.target,
          unit: goal.unit,
          percent: progress.percent,
          status: progress.status,
          hasValue: progress.hasValue,
          trackingOnly: progress.trackingOnly,
        },
      ];
    }),
    workout: workout
      ? {
          name: workout.name,
          completed: workout.completedAt !== null,
          setsDone,
          setsTotal,
        }
      : null,
    weight: {
      latest: snapshot.weight.latest,
      sevenDayAverage: snapshot.weight.sevenDayAverage,
      changeThisWeek: snapshot.weight.changeThisWeek,
    },
    week: {
      calories: snapshot.weekDays.map((day) => day.calories),
      protein: snapshot.weekDays.map((day) => day.protein),
      waterMl: snapshot.weekDays.map((day) => day.waterMl),
      sleepHours: snapshot.weekDays.map((day) => day.sleepHours),
      averages: {
        calories: snapshot.week.averages.calories,
        protein: snapshot.week.averages.protein,
        waterMl: snapshot.week.averages.waterMl,
        sleepHours: snapshot.week.averages.sleepHours,
      },
      workouts: snapshot.week.totals.workouts,
    },
    plan: {
      total: snapshot.plan.blocks.length,
      done: snapshot.plan.blocks.filter((block) => block.done).length,
      current: snapshot.plan.current
        ? { label: snapshot.plan.current.label, endTime: snapshot.plan.current.endTime }
        : null,
      next: snapshot.plan.next
        ? { label: snapshot.plan.next.label, startTime: snapshot.plan.next.startTime }
        : null,
    },
    tasks: {
      open: snapshot.tasks.open,
      overdue: snapshot.tasks.overdue,
      next: snapshot.tasks.items[0]?.title ?? null,
    },
    money: {
      currency: snapshot.money.currency,
      spentToday: snapshot.money.spentToday,
      nextBill: snapshot.money.bills[0]
        ? {
            name: snapshot.money.bills[0].name,
            amount: snapshot.money.bills[0].amount,
            dueDate: snapshot.money.bills[0].dueDate,
          }
        : null,
    },
    timer: snapshot.time.running
      ? {
          category: snapshot.time.running.category,
          label: snapshot.time.running.label,
          startedAt: snapshot.time.running.startAt.toISOString(),
        }
      : null,
  };
}
