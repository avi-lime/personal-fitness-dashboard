import { describe, expect, it } from "vitest";
import {
  computeAdherence,
  computeStreak,
  computeWeightStats,
  reviewHighlights,
  summarizePeriod,
} from "@/lib/aggregate";
import { computeGoalProgress, type GoalLike } from "@/lib/goals";
import { emptyDayFacts, type DayFacts } from "@/lib/metrics";
import { eachDay } from "@/lib/date";

const day = (date: string, overrides: Partial<DayFacts> = {}): DayFacts => ({
  ...emptyDayFacts(date),
  ...overrides,
});

const proteinGoal: GoalLike = {
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

describe("weight statistics", () => {
  const points = [
    { date: "2026-08-27", weightKg: 49.5 },
    { date: "2026-08-28", weightKg: 49.7 },
    { date: "2026-09-03", weightKg: 50.0 },
    { date: "2026-09-05", weightKg: 50.4 },
    { date: "2026-09-09", weightKg: 50.8 },
  ];

  it("reports the latest weigh-in and total change", () => {
    const stats = computeWeightStats(points, "2026-09-09");
    expect(stats.latest).toBe(50.8);
    expect(stats.latestDate).toBe("2026-09-09");
    expect(stats.first).toBe(49.5);
    expect(stats.changeSinceStart).toBe(1.3);
  });

  it("averages only the trailing seven days", () => {
    const stats = computeWeightStats(points, "2026-09-09");
    // 2026-09-03 is outside the 09-03..09-09 window? It is the first day of it.
    expect(stats.sevenDayAverage).toBe(50.4);
  });

  it("compares the last seven days with the seven before them", () => {
    const stats = computeWeightStats(points, "2026-09-09");
    // 7-day average 50.4 against the previous window's 49.6.
    expect(stats.changeThisWeek).toBe(0.8);
  });

  it("handles an empty history", () => {
    const stats = computeWeightStats([], "2026-09-09");
    expect(stats.latest).toBeNull();
    expect(stats.sevenDayAverage).toBeNull();
    expect(stats.changeSinceStart).toBeNull();
  });
});

describe("period summary", () => {
  const dates = eachDay("2026-09-07", "2026-09-13");

  it("averages over days that carry data, not the whole window", () => {
    const days = dates.map((date, index) =>
      index < 2
        ? day(date, { calories: 2000, protein: 100, waterMl: 2000, sleepHours: 8, workoutCount: 1 })
        : day(date),
    );
    const summary = summarizePeriod(days, "2026-09-07", "2026-09-13");
    expect(summary.days).toBe(7);
    expect(summary.daysWithData).toBe(2);
    expect(summary.averages.calories).toBe(2000);
    expect(summary.averages.sleepHours).toBe(8);
    expect(summary.totals.workouts).toBe(2);
    expect(summary.totals.calories).toBe(4000);
  });

  it("does not divide by zero on an empty week", () => {
    const summary = summarizePeriod(dates.map((date) => day(date)), "2026-09-07", "2026-09-13");
    expect(summary.averages.calories).toBe(0);
    expect(summary.daysWithData).toBe(0);
  });
});

describe("adherence and streaks", () => {
  const days = [
    day("2026-09-07", { protein: 120 }),
    day("2026-09-08", { protein: 40 }),
    day("2026-09-09", { protein: 105 }),
    day("2026-09-10", { protein: 101 }),
  ];
  const perDay = days.map((entry) => computeGoalProgress(proteinGoal, [entry]));

  it("counts the days a daily goal was met", () => {
    const adherence = computeAdherence(proteinGoal, perDay);
    expect(adherence.daysTracked).toBe(4);
    expect(adherence.daysMet).toBe(3);
    expect(adherence.adherence).toBe(0.75);
    expect(adherence.average).toBe(91.5);
  });

  it("counts the streak backwards from the most recent day", () => {
    expect(computeStreak(perDay)).toBe(2);
    expect(computeStreak([])).toBe(0);
  });
});

describe("review highlights", () => {
  it("picks the best and worst tracked goals and flags a weight move", () => {
    const adherence = [
      { goalId: "a", name: "Protein", unit: "g", daysMet: 7, daysTracked: 7, adherence: 1, average: 110, target: 100 },
      { goalId: "b", name: "Water", unit: "L", daysMet: 1, daysTracked: 7, adherence: 0.14, average: 1, target: 2.5 },
    ];
    const weight = computeWeightStats(
      [
        { date: "2026-08-30", weightKg: 50 },
        { date: "2026-09-09", weightKg: 51 },
      ],
      "2026-09-09",
    );
    const highlights = reviewHighlights(adherence, weight);
    expect(highlights.strongest?.name).toBe("Protein");
    expect(highlights.biggestMiss?.name).toBe("Water");
    expect(highlights.watch).toContain("weight");
  });

  it("never reports the same goal as both strongest and biggest miss", () => {
    const single = [
      { goalId: "a", name: "Protein", unit: "g", daysMet: 3, daysTracked: 7, adherence: 0.43, average: 90, target: 100 },
    ];
    const highlights = reviewHighlights(single, computeWeightStats([], "2026-09-09"));
    expect(highlights.strongest?.name).toBe("Protein");
    expect(highlights.biggestMiss).toBeNull();
  });
});
