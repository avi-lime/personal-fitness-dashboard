import { describe, expect, it } from "vitest";
import { sumNutrition } from "@/lib/nutrition";

describe("food totals", () => {
  it("adds calories and macros, treating unknown macros as zero", () => {
    const totals = sumNutrition([
      { calories: 420, proteinG: 18, carbsG: 62, fatG: 10 },
      { calories: 260, proteinG: 30 },
      { calories: 150, proteinG: null, carbsG: null, fatG: 4 },
    ]);
    expect(totals).toEqual({ calories: 830, proteinG: 48, carbsG: 62, fatG: 14 });
  });

  it("returns zeroes for an empty log", () => {
    expect(sumNutrition([])).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("rounds floating point drift", () => {
    const totals = sumNutrition([
      { calories: 0.1, proteinG: 0.2 },
      { calories: 0.2, proteinG: 0.1 },
    ]);
    expect(totals.calories).toBe(0.3);
    expect(totals.proteinG).toBe(0.3);
  });
});
