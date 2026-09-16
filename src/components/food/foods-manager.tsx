"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { useEstimate } from "@/components/assistant/use-estimate";
import { EstimateButton } from "@/components/assistant/estimate-button";
import { deleteFoodAction, logFoodAction, saveFoodAction } from "@/server/actions/logging";
import { formatValue } from "@/lib/format";
import type { Food } from "@/db/schema";

const BLANK = {
  name: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  servingQuantity: "1",
  servingUnit: "serving",
  estimated: false,
  assumption: "",
};

const optional = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

/** Reusable foods: define once, then log them in a click. */
export function FoodsManager({ foods }: { foods: Food[] }) {
  const [form, setForm] = useState(BLANK);
  const { pending, run } = useAction();
  const estimator = useEstimate();

  const set = <K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const estimateMacros = async () => {
    const result = await estimator.estimate("food_macros", {
      name: form.name.trim(),
      quantity: optional(form.servingQuantity) ?? 1,
      unit: form.servingUnit.trim() || "serving",
    });
    if (!result) return;
    setForm((previous) => ({
      ...previous,
      calories: String(Math.round(result.calories)),
      proteinG: String(Math.round(result.proteinG)),
      carbsG: String(Math.round(result.carbsG)),
      fatG: String(Math.round(result.fatG)),
      estimated: true,
      assumption: `${result.assumption} · ${result.confidence} confidence`,
    }));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Saved foods</h2>
        {foods.length === 0 ? (
          <EmptyState
            title="No saved foods"
            description="Save the things you eat often so logging them takes one click."
          />
        ) : (
          <Card className="gap-0 p-0">
            <ul className="divide-y">
              {foods.map((food) => (
                <li key={food.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-medium">{food.name}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {formatValue(food.servingQuantity)} {food.servingUnit} ·{" "}
                      {food.estimated ? "≈ " : ""}
                      {formatValue(food.calories)} kcal
                      {food.proteinG !== null ? ` · ${formatValue(food.proteinG)}g protein` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          logFoodAction({
                            foodId: food.id,
                            name: food.name,
                            calories: food.calories,
                            proteinG: food.proteinG,
                            carbsG: food.carbsG,
                            fatG: food.fatG,
                            quantity: food.servingQuantity,
                            unit: food.servingUnit,
                            mealType: "other",
                          }),
                        { success: `${food.name} logged` },
                      )
                    }
                  >
                    Log
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending}
                    aria-label={`Delete ${food.name}`}
                    onClick={() => run(() => deleteFoodAction(food.id), { success: "Food removed" })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <Card className="h-fit gap-3 p-4">
        <h2 className="text-sm font-medium">Add or update a food</h2>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () =>
                saveFoodAction({
                  name: form.name.trim(),
                  calories: Number(form.calories.replace(",", ".")) || 0,
                  proteinG: optional(form.proteinG),
                  carbsG: optional(form.carbsG),
                  fatG: optional(form.fatG),
                  servingQuantity: optional(form.servingQuantity) ?? 1,
                  servingUnit: form.servingUnit.trim() || "serving",
                  estimated: form.estimated,
                }),
              { success: "Food saved", onSuccess: () => setForm(BLANK) },
            );
          }}
        >
          <Field id="new-food-name" label="Name">
            <div className="flex gap-2">
              <Input
                id="new-food-name"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                required
              />
              <EstimateButton
                onClick={() => void estimateMacros()}
                pending={estimator.pending}
                disabled={form.name.trim() === ""}
              />
            </div>
            {form.assumption ? (
              <p className="text-xs text-muted-foreground">≈ {form.assumption}</p>
            ) : null}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="new-food-calories" label="Calories">
              <Input
                id="new-food-calories"
                inputMode="decimal"
                value={form.calories}
                onChange={(event) => set("calories", event.target.value)}
                required
              />
            </Field>
            <Field id="new-food-protein" label="Protein (g)">
              <Input
                id="new-food-protein"
                inputMode="decimal"
                value={form.proteinG}
                onChange={(event) => set("proteinG", event.target.value)}
              />
            </Field>
            <Field id="new-food-carbs" label="Carbs (g)">
              <Input
                id="new-food-carbs"
                inputMode="decimal"
                value={form.carbsG}
                onChange={(event) => set("carbsG", event.target.value)}
              />
            </Field>
            <Field id="new-food-fat" label="Fat (g)">
              <Input
                id="new-food-fat"
                inputMode="decimal"
                value={form.fatG}
                onChange={(event) => set("fatG", event.target.value)}
              />
            </Field>
            <Field id="new-food-qty" label="Serving">
              <Input
                id="new-food-qty"
                inputMode="decimal"
                value={form.servingQuantity}
                onChange={(event) => set("servingQuantity", event.target.value)}
              />
            </Field>
            <Field id="new-food-unit" label="Unit">
              <Input
                id="new-food-unit"
                value={form.servingUnit}
                onChange={(event) => set("servingUnit", event.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" disabled={pending || form.name.trim() === ""} className="w-full">
            <Plus className="size-4" aria-hidden /> Save food
          </Button>
        </form>
      </Card>
    </div>
  );
}
