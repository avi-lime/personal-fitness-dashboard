import { describe, expect, it } from "vitest";
import { METRIC_LIST, emptyDayFacts, isMetricKey, resolveMetric, type DayFacts } from "@/lib/metrics";
import { METRIC_KEYS } from "@/lib/domain";

const day = (date: string, overrides: Partial<DayFacts> = {}): DayFacts => ({
  ...emptyDayFacts(date),
  ...overrides,
});

describe("metric registry", () => {
  it("registers exactly the declared metric keys", () => {
    expect(METRIC_LIST.map((metric) => metric.key).sort()).toEqual([...METRIC_KEYS].sort());
  });

  it("recognises known keys only", () => {
    expect(isMetricKey("protein")).toBe(true);
    expect(isMetricKey("steps")).toBe(false);
  });
});

describe("resolveMetric", () => {
  const days = [
    day("2026-09-07", { calories: 2000, weightKg: 50 }),
    day("2026-09-08", { calories: 2200 }),
    day("2026-09-09", { calories: 1800, weightKg: 50.6 }),
  ];

  it("sums additive metrics across the window", () => {
    expect(resolveMetric("calories", "goal", days)).toBe(6000);
  });

  it("takes the most recent reading for latest-style metrics", () => {
    expect(resolveMetric("body_weight_kg", "goal", days)).toBe(50.6);
  });

  it("falls back to an earlier reading when the last day has none", () => {
    expect(resolveMetric("body_weight_kg", "goal", days.slice(0, 2))).toBe(50);
  });

  it("returns null when a latest-style metric has no readings at all", () => {
    expect(resolveMetric("body_weight_kg", "goal", [day("2026-09-09")])).toBeNull();
  });

  it("sums manual goal entries by goal id", () => {
    const manual = [
      day("2026-09-08", { manualByGoalId: { reading: 30, other: 99 } }),
      day("2026-09-09", { manualByGoalId: { reading: 15 } }),
    ];
    expect(resolveMetric(null, "reading", manual)).toBe(45);
    expect(resolveMetric(null, "missing", manual)).toBe(0);
  });
});
