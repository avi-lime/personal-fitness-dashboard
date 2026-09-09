import { Card } from "@/components/ui/card";
import { Stat } from "@/components/common/stat";
import { ProgressBar } from "@/components/charts/progress-bar";
import { formatValue } from "@/lib/format";
import type { NutritionTotals } from "@/lib/nutrition";

export interface MacroTarget {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/** Daily totals, always computed from the logged entries below them. */
export function NutritionSummary({
  totals,
  targets,
  entryCount,
}: {
  totals: NutritionTotals;
  targets: MacroTarget;
  entryCount: number;
}) {
  const rows: Array<{ label: string; value: number; target: number | null; unit: string }> = [
    { label: "Calories", value: totals.calories, target: targets.calories, unit: "kcal" },
    { label: "Protein", value: totals.proteinG, target: targets.proteinG, unit: "g" },
    { label: "Carbs", value: totals.carbsG, target: targets.carbsG, unit: "g" },
    { label: "Fat", value: totals.fatG, target: targets.fatG, unit: "g" },
  ];

  return (
    <Card className="gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Today&rsquo;s nutrition</h2>
        <p className="text-xs text-muted-foreground">
          {entryCount} {entryCount === 1 ? "entry" : "entries"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className="space-y-2">
            <Stat
              label={row.label}
              value={`${formatValue(row.value)} ${row.unit}`}
              detail={row.target ? `of ${formatValue(row.target)} ${row.unit}` : "no target"}
            />
            {row.target ? (
              <ProgressBar
                value={row.value / row.target}
                tone={row.value >= row.target ? "positive" : "neutral"}
                label={`${row.label}: ${formatValue(row.value)} of ${formatValue(row.target)} ${row.unit}`}
              />
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
