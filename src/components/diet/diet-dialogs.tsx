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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import {
  addDietMealAction,
  addDietMealOptionAction,
  createDietPlanAction,
  updateDietMealAction,
  updateDietMealOptionAction,
  updateDietPlanAction,
} from "@/server/actions/diet";
import { MEAL_TYPES, type MealType } from "@/lib/domain";
import type { DietMeal, DietMealOption, DietPlan } from "@/db/schema";

/** Blank strings mean "no value", which is how the nullable columns are stored. */
const num = (value: string): number | null => {
  const parsed = Number(value.replace(",", "."));
  return value.trim() === "" || !Number.isFinite(parsed) ? null : parsed;
};

const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  other: "Other",
};

export function PlanDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null creates a plan; a plan edits it. */
  plan: DietPlan | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit plan" : "New diet plan"}</DialogTitle>
          <DialogDescription>
            Targets the meals are designed around. Your goals stay the thing that tracks progress.
          </DialogDescription>
        </DialogHeader>
        {open ? <PlanForm plan={plan} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function PlanForm({ plan, onDone }: { plan: DietPlan | null; onDone: () => void }) {
  const [name, setName] = useState(plan?.name ?? "");
  const [goal, setGoal] = useState(plan?.goal ?? "");
  const [calories, setCalories] = useState(plan?.calorieTarget?.toString() ?? "");
  const [protein, setProtein] = useState(plan?.proteinTarget?.toString() ?? "");
  const [carbs, setCarbs] = useState(plan?.carbsTarget?.toString() ?? "");
  const [fat, setFat] = useState(plan?.fatTarget?.toString() ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const { pending, run } = useAction();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = {
          name: name.trim(),
          goal: goal.trim() || null,
          calorieTarget: num(calories),
          proteinTarget: num(protein),
          carbsTarget: num(carbs),
          fatTarget: num(fat),
          notes: notes.trim() || null,
        };
        run(
          () =>
            plan
              ? updateDietPlanAction({ ...payload, planId: plan.id })
              : createDietPlanAction(payload),
          { success: plan ? "Plan updated" : "Plan created", onSuccess: onDone },
        );
      }}
    >
      <Field id="plan-name" label="Name">
        <Input id="plan-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Lean Muscle Gain" />
      </Field>
      <Field id="plan-goal" label="Goal">
        <Input id="plan-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Reach at least 57 kg while building lean muscle" />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field id="plan-calories" label="Calories">
          <Input id="plan-calories" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="2200" />
        </Field>
        <Field id="plan-protein" label="Protein (g)">
          <Input id="plan-protein" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="150" />
        </Field>
        <Field id="plan-carbs" label="Carbs (g)">
          <Input id="plan-carbs" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </Field>
        <Field id="plan-fat" label="Fat (g)">
          <Input id="plan-fat" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
        </Field>
      </div>
      <Field id="plan-notes" label="Notes">
        <Textarea id="plan-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Supplements, foods to avoid for now…" />
      </Field>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending || name.trim() === ""}>
          {plan ? "Save changes" : "Create plan"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function MealDialog({
  open,
  onOpenChange,
  planId,
  meal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  meal: DietMeal | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{meal ? `Edit ${meal.name}` : "Add meal"}</DialogTitle>
          <DialogDescription>A slot in the day. Add what you can eat for it afterwards.</DialogDescription>
        </DialogHeader>
        {open ? <MealForm planId={planId} meal={meal} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MealForm({ planId, meal, onDone }: { planId: string; meal: DietMeal | null; onDone: () => void }) {
  const [name, setName] = useState(meal?.name ?? "");
  const [time, setTime] = useState(meal?.recommendedTime ?? "");
  const [mealType, setMealType] = useState<MealType>(meal?.mealType ?? "other");
  const [calories, setCalories] = useState(meal?.calorieTarget?.toString() ?? "");
  const [protein, setProtein] = useState(meal?.proteinTarget?.toString() ?? "");
  const [notes, setNotes] = useState(meal?.notes ?? "");
  const { pending, run } = useAction();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = {
          name: name.trim(),
          recommendedTime: time.trim() || null,
          mealType,
          calorieTarget: num(calories),
          proteinTarget: num(protein),
          notes: notes.trim() || null,
        };
        run(
          () =>
            meal
              ? updateDietMealAction({ ...payload, mealId: meal.id })
              : addDietMealAction({ ...payload, planId }),
          { success: meal ? "Meal updated" : "Meal added", onSuccess: onDone },
        );
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field id="meal-name" label="Name">
          <Input id="meal-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Afternoon snack" />
        </Field>
        <Field id="meal-time" label="Recommended time">
          <Input id="meal-time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="17:00-17:30" />
        </Field>
        <Field id="meal-type" label="Logs as">
          <Select value={mealType} onValueChange={(value) => setMealType(value as MealType)}>
            <SelectTrigger id="meal-type" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MEAL_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{MEAL_TYPE_LABELS[type]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="meal-calories" label="Calories">
            <Input id="meal-calories" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="650" />
          </Field>
          <Field id="meal-protein" label="Protein (g)">
            <Input id="meal-protein" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="33" />
          </Field>
        </div>
      </div>
      <Field id="meal-notes" label="Notes">
        <Textarea id="meal-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending || name.trim() === ""}>
          {meal ? "Save changes" : "Add meal"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function OptionDialog({
  open,
  onOpenChange,
  mealId,
  mealName,
  option,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealId: string;
  mealName: string;
  option: DietMealOption | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{option ? `Edit ${option.name}` : `Add an option to ${mealName}`}</DialogTitle>
          <DialogDescription>
            One way to eat this meal. Macros are estimates used for planning.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <OptionForm mealId={mealId} option={option} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function OptionForm({
  mealId,
  option,
  onDone,
}: {
  mealId: string;
  option: DietMealOption | null;
  onDone: () => void;
}) {
  const [name, setName] = useState(option?.name ?? "");
  const [description, setDescription] = useState(option?.description ?? "");
  const [ingredients, setIngredients] = useState((option?.ingredients ?? []).join("\n"));
  const [calories, setCalories] = useState(option?.calories?.toString() ?? "");
  const [protein, setProtein] = useState(option?.proteinG?.toString() ?? "");
  const [carbs, setCarbs] = useState(option?.carbsG?.toString() ?? "");
  const [fat, setFat] = useState(option?.fatG?.toString() ?? "");
  const [isDefault, setIsDefault] = useState(option?.isDefault ?? false);
  const { pending, run } = useAction();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = {
          name: name.trim(),
          description: description.trim() || null,
          ingredients: ingredients
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
          calories: num(calories),
          proteinG: num(protein),
          carbsG: num(carbs),
          fatG: num(fat),
          isDefault,
        };
        run(
          () =>
            option
              ? updateDietMealOptionAction({ ...payload, optionId: option.id })
              : addDietMealOptionAction({ ...payload, mealId }),
          { success: option ? "Option updated" : "Option added", onSuccess: onDone },
        );
      }}
    >
      <Field id="option-name" label="Name">
        <Input id="option-name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus placeholder="Chicken with rice" />
      </Field>
      <Field id="option-description" label="Description">
        <Input id="option-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Plain, grilled or tandoori" />
      </Field>
      <Field id="option-ingredients" label="Ingredients" hint="One per line, with the quantities you think in.">
        <Textarea
          id="option-ingredients"
          value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          rows={4}
          placeholder={"150-200g chicken\nrice and/or roti"}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field id="option-calories" label="Calories">
          <Input id="option-calories" inputMode="decimal" value={calories} onChange={(e) => setCalories(e.target.value)} />
        </Field>
        <Field id="option-protein" label="Protein (g)">
          <Input id="option-protein" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
        </Field>
        <Field id="option-carbs" label="Carbs (g)">
          <Input id="option-carbs" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        </Field>
        <Field id="option-fat" label="Fat (g)">
          <Input id="option-fat" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={isDefault} onCheckedChange={setIsDefault} aria-label="Default option" />
        Make this the usual choice for the meal
      </label>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button type="submit" disabled={pending || name.trim() === ""}>
          {option ? "Save changes" : "Add option"}
        </Button>
      </DialogFooter>
    </form>
  );
}
