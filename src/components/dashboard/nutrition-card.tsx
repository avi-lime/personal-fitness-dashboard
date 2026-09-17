import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/charts/progress-bar";
import { formatValue } from "@/lib/format";

export interface NutritionTargets {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** Water goals are expressed in litres, the same as the metric. */
  waterLitres: number | null;
}

export interface NutritionToday {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
}

/**
 * Today's calories at a glance, so the number never needs a trip to the Food
 * page. Macros and water sit beside it because they are read together.
 */
export function NutritionCard({
  totals,
  targets,
}: {
  totals: NutritionToday;
  targets: NutritionTargets;
}) {
  const macros: Array<{ label: string; value: number; target: number | null; unit: string }> = [
    { label: "Protein", value: totals.protein, target: targets.protein, unit: "g" },
    { label: "Carbs", value: totals.carbs, target: targets.carbs, unit: "g" },
    { label: "Fat", value: totals.fat, target: targets.fat, unit: "g" },
    { label: "Water", value: totals.waterMl / 1000, target: targets.waterLitres, unit: "L" },
  ];

  return (
    <Card className="gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Food today</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/food">Open</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">Calories</p>
          <p className="tabular text-3xl font-medium">
            {formatValue(totals.calories)}
            <span className="ml-1.5 text-sm font-normal text-muted-foreground">
              {targets.calories ? `of ${formatValue(targets.calories)} kcal` : "kcal"}
            </span>
          </p>
        </div>
        {targets.calories ? (
          <div className="min-w-[8rem] flex-1 pb-2">
            <ProgressBar
              value={totals.calories / targets.calories}
              tone={totals.calories > targets.calories ? "neutral" : "positive"}
              label={`Calories: ${formatValue(totals.calories)} of ${formatValue(targets.calories)} kcal`}
            />
          </div>
        ) : null}
      </div>

      <dl className="grid grid-cols-4 gap-3 border-t pt-3">
        {macros.map((macro) => (
          <div key={macro.label}>
            <dt className="text-xs text-muted-foreground">{macro.label}</dt>
            <dd className="tabular text-sm font-medium">
              {formatValue(macro.value)}
              <span className="text-xs font-normal text-muted-foreground">
                {macro.unit}
                {macro.target ? ` / ${formatValue(macro.target)}` : ""}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
