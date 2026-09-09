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
