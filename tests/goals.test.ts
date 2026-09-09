import { describe, expect, it } from "vitest";
import {
  checklistCompletion,
  computeAllGoalProgress,
  computeGoalProgress,
  effectiveTarget,
  periodWindow,
  sortGoals,
  type GoalLike,
} from "@/lib/goals";
import { emptyDayFacts, type DayFacts } from "@/lib/metrics";

function goal(overrides: Partial<GoalLike> = {}): GoalLike {
  return {
    id: "goal-1",
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
    ...overrides,
  };
}

function day(date: string, overrides: Partial<DayFacts> = {}): DayFacts {
  return { ...emptyDayFacts(date), ...overrides };
}

describe("goal progress", () => {
  it("computes percentage and remaining against the target", () => {
    const progress = computeGoalProgress(goal(), [day("2026-09-09", { protein: 82 })]);
    expect(progress.current).toBe(82);
    expect(progress.target).toBe(100);
    expect(progress.progress).toBe(0.82);
    expect(progress.percent).toBe(82);
    expect(progress.remaining).toBe(18);
    expect(progress.status).toBe("in_progress");
  });

  it("clamps progress at 100% once the target is met", () => {
    const progress = computeGoalProgress(goal(), [day("2026-09-09", { protein: 140 })]);
    expect(progress.progress).toBe(1);
    expect(progress.percent).toBe(100);
    expect(progress.remaining).toBe(0);
    expect(progress.status).toBe("complete");
  });

  it("reports not_started with no data", () => {
    const progress = computeGoalProgress(goal(), [day("2026-09-09")]);
    expect(progress.status).toBe("not_started");
    expect(progress.percent).toBe(0);
  });

  it("converts water from millilitres to litres", () => {
    const water = goal({ id: "w", name: "Water", unit: "L", targetValue: 2.5, metricKey: "water_ml" });
    const progress = computeGoalProgress(water, [day("2026-09-09", { waterMl: 1800 })]);
    expect(progress.current).toBe(1.8);
    expect(progress.percent).toBe(72);
  });

  it("treats boolean goals as a target of one", () => {
    const habit = goal({ id: "h", name: "Creatine", type: "boolean", metricKey: null, targetValue: null, unit: null });
    expect(effectiveTarget(habit)).toBe(1);
    const done = computeGoalProgress(habit, [day("2026-09-09", { manualByGoalId: { h: 1 } })]);
    expect(done.status).toBe("complete");
    const notDone = computeGoalProgress(habit, [day("2026-09-09")]);
    expect(notDone.status).toBe("not_started");
  });

  it("marks a goal without a target as tracking-only", () => {
    const weight = goal({ id: "bw", name: "Weight", targetValue: null, metricKey: "body_weight_kg", unit: "kg" });
    const progress = computeGoalProgress(weight, [day("2026-09-09", { weightKg: 50.4 })]);
    expect(progress.trackingOnly).toBe(true);
    expect(progress.target).toBeNull();
    expect(progress.current).toBe(50.4);
    expect(progress.progress).toBe(0);
    expect(progress.hasValue).toBe(true);
  });

  it("distinguishes a missing reading from a zero reading", () => {
    const weight = goal({ id: "bw", targetValue: null, metricKey: "body_weight_kg" });
    expect(computeGoalProgress(weight, [day("2026-09-09")]).hasValue).toBe(false);
  });

  it("sums a weekly goal across its whole period", () => {
    const weekly = goal({ period: "weekly", targetValue: 700 });
    const days = ["2026-09-07", "2026-09-08", "2026-09-09"].map((date) =>
      day(date, { protein: 100 }),
    );
    expect(computeGoalProgress(weekly, days).current).toBe(300);
  });
});

describe("period windows", () => {
  it("returns the day, Monday-based week or calendar month", () => {
    expect(periodWindow("daily", "2026-09-09")).toEqual({
      start: "2026-09-09",
      end: "2026-09-09",
    });
    expect(periodWindow("weekly", "2026-09-09")).toEqual({
      start: "2026-09-07",
      end: "2026-09-13",
    });
    expect(periodWindow("monthly", "2026-09-09")).toEqual({
      start: "2026-09-01",
      end: "2026-09-30",
    });
  });
});

describe("computeAllGoalProgress", () => {
  const facts = new Map<string, DayFacts>([
    ["2026-09-07", day("2026-09-07", { protein: 90, waterMl: 2000 })],
    ["2026-09-08", day("2026-09-08", { protein: 110, waterMl: 2500 })],
    ["2026-09-09", day("2026-09-09", { protein: 40, waterMl: 1000 })],
  ]);

  it("scopes each goal to its own period window", () => {
    const daily = goal({ id: "daily", period: "daily" });
    const weekly = goal({ id: "weekly", period: "weekly", targetValue: 700 });
    const [dailyProgress, weeklyProgress] = computeAllGoalProgress(
      [daily, weekly],
      "2026-09-09",
      facts,
    );
    expect(dailyProgress.current).toBe(40);
    expect(weeklyProgress.current).toBe(240);
  });
});

describe("checklist", () => {
  it("counts only active goals shown in the checklist", () => {
    const goals = [
      goal({ id: "a" }),
      goal({ id: "b", showInChecklist: false }),
      goal({ id: "c", active: false }),
      goal({ id: "d" }),
    ];
    const progressById = new Map(
      goals.map((entry) => [
        entry.id,
        computeGoalProgress(entry, [
          day("2026-09-09", { protein: entry.id === "a" ? 120 : 10 }),
        ]),
      ]),
    );
    expect(checklistCompletion(goals, progressById)).toBe(0.5);
  });

  it("is zero when nothing is on the checklist", () => {
    expect(checklistCompletion([], new Map())).toBe(0);
  });
});

describe("sortGoals", () => {
  it("orders by sortOrder then name", () => {
    const ordered = sortGoals([
      goal({ id: "b", name: "Beta", sortOrder: 1 }),
      goal({ id: "a", name: "Alpha", sortOrder: 1 }),
      goal({ id: "c", name: "Gamma", sortOrder: 0 }),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual(["c", "a", "b"]);
  });
});
