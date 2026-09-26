import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatValue } from "@/lib/format";

export interface DietCardMeal {
  id: string;
  name: string;
  recommendedTime: string | null;
  defaultOption: string | null;
  calorieTarget: number | null;
}

/** The plan at a glance: what to eat today, in order. Editing lives on /diet. */
export function DietCard({
  planName,
  calorieTarget,
  proteinTarget,
  meals,
}: {
  planName: string;
  calorieTarget: number | null;
  proteinTarget: number | null;
  meals: DietCardMeal[];
}) {
  const targets = [
    calorieTarget ? `${formatValue(calorieTarget)} kcal` : null,
    proteinTarget ? `${formatValue(proteinTarget)} g protein` : null,
  ].filter(Boolean);

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium">{planName}</h2>
          {targets.length > 0 ? (
            <p className="tabular text-xs text-muted-foreground">{targets.join(" · ")}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/diet">Open</Link>
        </Button>
      </div>
      <ul className="divide-y">
        {meals.map((meal) => (
          <li key={meal.id} className="flex items-baseline gap-3 px-4 py-2">
            <span className="w-24 shrink-0 text-sm">{meal.name}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {meal.defaultOption ?? "—"}
            </span>
            {meal.calorieTarget ? (
              <span className="tabular shrink-0 text-xs text-muted-foreground">
                {formatValue(meal.calorieTarget)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}
