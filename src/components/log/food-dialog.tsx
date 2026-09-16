"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { useEstimate } from "@/components/assistant/use-estimate";
import { EstimateButton } from "@/components/assistant/estimate-button";
import { logFoodAction, updateFoodLogAction } from "@/server/actions/logging";
import { MEAL_TYPES, type MealType } from "@/lib/domain";
import type { Food, FoodLog } from "@/db/schema";

export interface FoodDialogEntry {
  id: string;
  name: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  quantity: number;
  unit: string;
  mealType: MealType;
  notes: string | null;
  estimated: boolean;
}

const BLANK = {
  name: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  quantity: "1",
  unit: "serving",
  mealType: "other" as MealType,
  notes: "",
  estimated: false,
  assumption: "",
};

type FormState = typeof BLANK;

function toForm(entry: FoodDialogEntry): FormState {
  return {
    name: entry.name,
    calories: String(entry.calories),
    proteinG: entry.proteinG === null ? "" : String(entry.proteinG),
    carbsG: entry.carbsG === null ? "" : String(entry.carbsG),
    fatG: entry.fatG === null ? "" : String(entry.fatG),
    quantity: String(entry.quantity),
    unit: entry.unit,
    mealType: entry.mealType,
    notes: entry.notes ?? "",
    estimated: entry.estimated,
    assumption: "",
  };
}

const optionalNumber = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Logs or edits a food entry. Only name and calories are required — partial
 * macros are normal and are stored as null rather than guessed.
 */
export function FoodDialog({
  open,
  onOpenChange,
  entry,
  foods = [],
  defaultMealType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry?: FoodDialogEntry | null;
  foods?: Food[];
  defaultMealType?: MealType;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit food entry" : "Log food"}</DialogTitle>
          <DialogDescription>
            Calories are required. Leave macros blank if you do not know them.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <FoodForm
            key={entry?.id ?? "new"}
            entry={entry}
            foods={foods}
            defaultMealType={defaultMealType}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FoodForm({
  entry,
  foods,
  defaultMealType,
  onDone,
}: {
  entry?: FoodDialogEntry | null;
  foods: Food[];
  defaultMealType?: MealType;
  onDone: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    entry ? toForm(entry) : { ...BLANK, mealType: defaultMealType ?? "other" },
  );
  const { pending, run } = useAction();
  const estimator = useEstimate();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const estimateMacros = async () => {
    const result = await estimator.estimate("food_macros", {
      name: form.name.trim(),
      quantity: optionalNumber(form.quantity) ?? 1,
      unit: form.unit.trim() || "serving",
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

  const applyFood = (foodId: string) => {
    const food = foods.find((item) => item.id === foodId);
    if (!food) return;
    setForm((previous) => ({
      ...previous,
      name: food.name,
      calories: String(food.calories),
      proteinG: food.proteinG === null ? "" : String(food.proteinG),
      carbsG: food.carbsG === null ? "" : String(food.carbsG),
      fatG: food.fatG === null ? "" : String(food.fatG),
      quantity: String(food.servingQuantity),
      unit: food.servingUnit,
      estimated: food.estimated,
      assumption: "",
    }));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name.trim(),
      calories: Number(form.calories.replace(",", ".")) || 0,
      proteinG: optionalNumber(form.proteinG),
      carbsG: optionalNumber(form.carbsG),
      fatG: optionalNumber(form.fatG),
      quantity: optionalNumber(form.quantity) ?? 1,
      unit: form.unit.trim() || "serving",
      mealType: form.mealType,
      notes: form.notes.trim() === "" ? null : form.notes.trim(),
      estimated: form.estimated,
    };
    run(
      () => (entry ? updateFoodLogAction(entry.id, payload) : logFoodAction(payload)),
      { success: entry ? "Entry updated" : "Food logged", onSuccess: onDone },
    );
  };

  return (
        <form onSubmit={submit} className="space-y-4">
          {foods.length > 0 && !entry ? (
            <Field id="food-preset" label="Use a saved food">
              <Select onValueChange={applyFood}>
                <SelectTrigger id="food-preset" className="w-full">
                  <SelectValue placeholder="Pick from your foods…" />
                </SelectTrigger>
                <SelectContent>
                  {foods.map((food) => (
                    <SelectItem key={food.id} value={food.id}>
                      {food.name} · {food.calories} kcal
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="food-name" label="Food" className="sm:col-span-2">
              <div className="flex gap-2">
                <Input
                  id="food-name"
                  value={form.name}
                  onChange={(event) => set("name", event.target.value)}
                  required
                  autoFocus
                  placeholder="Breakfast oats"
                />
                <EstimateButton
                  onClick={() => void estimateMacros()}
                  pending={estimator.pending}
                  disabled={form.name.trim() === ""}
                  label="Estimate macros"
                  title="Fill calories and macros with a typical estimate for this food and quantity"
                />
              </div>
              {form.assumption ? (
                <p className="text-xs text-muted-foreground">≈ {form.assumption}. Edit anything that looks off.</p>
              ) : null}
            </Field>
            <Field id="food-calories" label="Calories (kcal)">
              <Input
                id="food-calories"
                inputMode="decimal"
                value={form.calories}
                onChange={(event) => set("calories", event.target.value)}
                required
              />
            </Field>
            <Field id="food-protein" label="Protein (g)">
              <Input
                id="food-protein"
                inputMode="decimal"
                value={form.proteinG}
                onChange={(event) => set("proteinG", event.target.value)}
                placeholder="optional"
              />
            </Field>
            <Field id="food-carbs" label="Carbs (g)">
              <Input
                id="food-carbs"
                inputMode="decimal"
                value={form.carbsG}
                onChange={(event) => set("carbsG", event.target.value)}
                placeholder="optional"
              />
            </Field>
            <Field id="food-fat" label="Fat (g)">
              <Input
                id="food-fat"
                inputMode="decimal"
                value={form.fatG}
                onChange={(event) => set("fatG", event.target.value)}
                placeholder="optional"
              />
            </Field>
            <Field id="food-quantity" label="Quantity">
              <Input
                id="food-quantity"
                inputMode="decimal"
                value={form.quantity}
                onChange={(event) => set("quantity", event.target.value)}
              />
            </Field>
            <Field id="food-unit" label="Unit">
              <Input
                id="food-unit"
                value={form.unit}
                onChange={(event) => set("unit", event.target.value)}
              />
            </Field>
            <Field id="food-meal" label="Meal" className="sm:col-span-2">
              <Select
                value={form.mealType}
                onValueChange={(value) => set("mealType", value as MealType)}
              >
                <SelectTrigger id="food-meal" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEAL_TYPES.map((meal) => (
                    <SelectItem key={meal} value={meal} className="capitalize">
                      {meal}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm text-muted-foreground sm:col-span-2">
              <input
                type="checkbox"
                checked={form.estimated}
                onChange={(event) => set("estimated", event.target.checked)}
                className="size-4 accent-foreground"
              />
              These values are an estimate (shown with ≈)
            </label>
            <Field id="food-notes" label="Notes" className="sm:col-span-2">
              <Textarea
                id="food-notes"
                value={form.notes}
                onChange={(event) => set("notes", event.target.value)}
                rows={2}
                placeholder="optional"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {entry ? "Save changes" : "Log food"}
            </Button>
          </DialogFooter>
        </form>
  );
}

export function toDialogEntry(log: FoodLog): FoodDialogEntry {
  return {
    id: log.id,
    name: log.name,
    calories: log.calories,
    proteinG: log.proteinG,
    carbsG: log.carbsG,
    fatG: log.fatG,
    quantity: log.quantity,
    unit: log.unit,
    mealType: log.mealType,
    notes: log.notes,
    estimated: log.estimated,
  };
}
