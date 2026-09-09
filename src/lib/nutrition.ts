import { round } from "./goals";

export interface NutritionTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface NutritionEntry {
  calories: number;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
}

/** The one implementation of "add up a list of food entries". */
export function sumNutrition(entries: NutritionEntry[]): NutritionTotals {
  const totals = entries.reduce<NutritionTotals>(
    (acc, entry) => ({
      calories: acc.calories + (entry.calories ?? 0),
      proteinG: acc.proteinG + (entry.proteinG ?? 0),
      carbsG: acc.carbsG + (entry.carbsG ?? 0),
      fatG: acc.fatG + (entry.fatG ?? 0),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return {
    calories: round(totals.calories),
    proteinG: round(totals.proteinG),
    carbsG: round(totals.carbsG),
    fatG: round(totals.fatG),
  };
}
