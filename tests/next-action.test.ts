import { describe, expect, it } from "vitest";
import { resolveNextAction } from "@/lib/next-action";
import { computeGoalProgress, type GoalLike, type GoalProgress } from "@/lib/goals";
import { emptyDayFacts, type DayFacts } from "@/lib/metrics";

const base: GoalLike = {
  id: "protein",
  name: "Protein",
  description: null,
  type: "numeric",
  unit: "g",
  targetValue: 100,
  period: "daily",
  metricKey: "protein",
  metricParam: null,
  area: null,
  active: true,
  visibleOnDashboard: true,
  showInChecklist: true,
  sortOrder: 0,
  color: null,
  icon: null,
};

const day = (overrides: Partial<DayFacts> = {}): DayFacts => ({
  ...emptyDayFacts("2026-09-09"),
  ...overrides,
});

function progressMap(pairs: Array<[GoalLike, DayFacts]>): Map<string, GoalProgress> {
  return new Map(pairs.map(([goal, facts]) => [goal.id, computeGoalProgress(goal, [facts])]));
}

describe("next action", () => {
  it("prefers an outstanding discrete goal", () => {
    const workout: GoalLike = {
      ...base,
      id: "workout",
      name: "Workout",
      type: "count",
      unit: "sessions",
      targetValue: 1,
      metricKey: "workouts",
      sortOrder: 1,
    };
    const goals = [base, workout];
    const action = resolveNextAction({
      goals,
      progressById: progressMap([
        [base, day({ protein: 78 })],
        [workout, day()],
      ]),
    });
    expect(action.type).toBe("goal");
    expect(action.goalId).toBe("workout");
    expect(action.label).toBe("Workout");
  });

  it("otherwise nudges the numeric goal furthest from its target", () => {
    const water: GoalLike = {
      ...base,
      id: "water",
      name: "Water",
      unit: "L",
      targetValue: 2.5,
      metricKey: "water_ml",
      sortOrder: 1,
    };
    const action = resolveNextAction({
      goals: [base, water],
      progressById: progressMap([
        [base, day({ protein: 78 })],
        [water, day({ waterMl: 2300 })],
      ]),
    });
    expect(action.goalId).toBe("protein");
    expect(action.label).toBe("22 g protein remaining");
    expect(action.detail).toBe("78 / 100 g");
  });

  it("ignores goals excluded from the checklist and paused goals", () => {
    const hidden: GoalLike = { ...base, id: "hidden", showInChecklist: false };
    const paused: GoalLike = { ...base, id: "paused", active: false };
    const action = resolveNextAction({
      goals: [hidden, paused],
      progressById: progressMap([
        [hidden, day()],
        [paused, day()],
      ]),
    });
    expect(action.type).toBe("idle");
  });

  it("reports all clear when every goal is met", () => {
    const action = resolveNextAction({
      goals: [base],
      progressById: progressMap([[base, day({ protein: 120 })]]),
    });
    expect(action.type).toBe("idle");
    expect(action.label).toBe("All goals met");
  });

  it("prompts for a first goal when none exist", () => {
    const action = resolveNextAction({ goals: [], progressById: new Map() });
    expect(action.label).toBe("Add your first goal");
  });
});

describe("time-bound strategies outrank goals", () => {
  const goals = [base];
  const progressById = progressMap([[base, day({ protein: 20 })]]);
  const today = "2026-09-16";

  it("names the block happening right now", () => {
    const action = resolveNextAction({
      goals,
      progressById,
      today,
      nowTime: "10:30",
      blocks: [{ id: "b", label: "Deep work", startTime: "10:00", endTime: "12:00", done: false }],
    });
    expect(action).toMatchObject({ type: "block", label: "Deep work", detail: "Now · until 12:00", href: "/plan" });
  });

  it("skips a current block that is already done and falls through", () => {
    const action = resolveNextAction({
      goals,
      progressById,
      today,
      nowTime: "10:30",
      blocks: [{ id: "b", label: "Deep work", startTime: "10:00", endTime: "12:00", done: true }],
    });
    expect(action.type).toBe("goal");
  });

  it("puts an overdue task before a bill, and a bill before a goal", () => {
    const bills = [{ id: "bill", name: "Electricity", amount: 1800, dueDate: "2026-09-17" }];
    const withTask = resolveNextAction({
      goals,
      progressById,
      today,
      tasks: [{ id: "t", title: "Update resume", dueDate: "2026-09-15", priority: "high" }],
      bills,
      currency: "INR",
    });
    expect(withTask).toMatchObject({ type: "task", label: "Update resume", href: "/tasks" });

    const withoutTask = resolveNextAction({ goals, progressById, today, bills, currency: "INR" });
    expect(withoutTask).toMatchObject({ type: "bill", label: "Pay Electricity" });
    expect(withoutTask.detail).toContain("due 2026-09-17");
  });

  it("ignores bills due later than two days", () => {
    const action = resolveNextAction({
      goals,
      progressById,
      today,
      bills: [{ id: "bill", name: "Rent", amount: 18000, dueDate: "2026-09-30" }],
    });
    expect(action.type).toBe("goal");
  });

  it("surfaces an application next step that is due", () => {
    const action = resolveNextAction({
      goals,
      progressById,
      today,
      applications: [
        { id: "a", company: "Acme", role: "Senior Engineer", nextStep: "System design round", nextStepDate: today },
      ],
    });
    expect(action).toMatchObject({ type: "application", label: "System design round", detail: "Acme · Senior Engineer" });
  });

  it("announces a block starting within the hour, but not later", () => {
    const blocks = [{ id: "b", label: "Study", startTime: "20:00", endTime: "21:00", done: false }];
    expect(resolveNextAction({ goals, progressById, today, nowTime: "19:20", blocks })).toMatchObject({
      type: "block",
      detail: "Up next at 20:00",
    });
    expect(resolveNextAction({ goals, progressById, today, nowTime: "17:00", blocks }).type).toBe("goal");
  });
});
