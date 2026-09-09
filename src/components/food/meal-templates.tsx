"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { applyMealTemplateAction, deleteMealTemplateAction } from "@/server/actions/logging";
import { formatValue } from "@/lib/format";
import { sumNutrition } from "@/lib/nutrition";

export interface MealTemplateView {
  id: string;
  name: string;
  mealType: string;
  items: Array<{
    id: string;
    name: string;
    calories: number;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
  }>;
}

export function MealTemplates({ templates }: { templates: MealTemplateView[] }) {
  const { pending, run } = useAction();

  if (templates.length === 0) {
    return (
      <EmptyState
        title="No meal templates"
        description="Select entries on the Today tab and save them as a reusable meal."
      />
    );
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => {
        const totals = sumNutrition(template.items);
        return (
          <li key={template.id}>
            <Card className="gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">{template.name}</h3>
                  <p className="tabular text-xs text-muted-foreground capitalize">
                    {template.mealType} · {formatValue(totals.calories)} kcal ·{" "}
                    {formatValue(totals.proteinG)} g protein
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Delete ${template.name}`}
                  onClick={() =>
                    run(() => deleteMealTemplateAction(template.id), { success: "Template deleted" })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {template.items.map((item) => (
                  <li key={item.id} className="tabular">
                    {item.name} · {formatValue(item.calories)} kcal
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => applyMealTemplateAction(template.id), {
                    success: `${template.name} logged`,
                  })
                }
              >
                Log this meal
              </Button>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
