"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Pencil, Plus, RotateCcw, Star, Utensils, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { MealDialog, OptionDialog, PlanDialog } from "./diet-dialogs";
import {
  logDietMealOptionAction,
  reorderDietMealsAction,
  updateDietMealAction,
  updateDietMealOptionAction,
  updateDietPlanAction,
} from "@/server/actions/diet";
import { formatValue } from "@/lib/format";
import type { DietMeal, DietMealOption, DietPlan } from "@/db/schema";
import { cn } from "@/lib/utils";

interface MealWithOptions extends DietMeal {
  options: DietMealOption[];
}

/**
 * The diet plan: what to eat, not what was eaten.
 *
 * Every mutation here edits the plan. The one exception is "Log this meal",
 * which writes a food log and says so — it is never implied by the plan alone.
 */
export function DietPlanManager({
  plan,
  meals,
  plans,
  goalTargets,
}: {
  plan: DietPlan | null;
  meals: MealWithOptions[];
  plans: Array<{ id: string; name: string; active: boolean }>;
  /** The daily nutrition goals, shown when they disagree with the plan. */
  goalTargets: { calories: number | null; protein: number | null };
}) {
  const { pending, run } = useAction();
  const [showDisabled, setShowDisabled] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [mealDialog, setMealDialog] = useState<{ meal: DietMeal | null } | null>(null);
  const [optionDialog, setOptionDialog] = useState<{
    meal: MealWithOptions;
    option: DietMealOption | null;
  } | null>(null);

  const visibleMeals = meals.filter((meal) => meal.active || showDisabled);
  const activeMeals = meals.filter((meal) => meal.active);

  const move = (mealId: string, direction: -1 | 1) => {
    if (!plan) return;
    const order = activeMeals.map((meal) => meal.id);
    const from = order.indexOf(mealId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= order.length) return;
    [order[from], order[to]] = [order[to], order[from]];
    run(() => reorderDietMealsAction({ planId: plan.id, mealIds: order }), { success: "Order saved" });
  };

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl">Diet</h1>
        <p className="text-sm text-muted-foreground">
          What you plan to eat. What you actually ate lives in{" "}
          <Link href="/food" className="underline underline-offset-2">Food</Link>.
        </p>
      </div>
      <div className="flex items-center gap-2">
        {plans.length > 1 ? (
          <Select
            value={plans.find((entry) => entry.active)?.id ?? ""}
            onValueChange={(planId) =>
              run(() => updateDietPlanAction({ planId, active: true }), { success: "Plan switched" })
            }
          >
            <SelectTrigger className="w-44"><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              {plans.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button size="sm" variant={plan ? "outline" : "default"} onClick={() => setPlanOpen(true)}>
          {plan ? <><Pencil className="size-3.5" aria-hidden /> Edit plan</> : <><Plus className="size-3.5" aria-hidden /> New plan</>}
        </Button>
      </div>
    </div>
  );

  if (!plan) {
    return (
      <div className="space-y-5">
        {header}
        <Card className="p-4">
          <EmptyState
            title="No diet plan yet."
            description="Set your daily targets, then add the meals and what you can eat for each."
            action={<Button size="sm" onClick={() => setPlanOpen(true)}>Create a plan</Button>}
          />
        </Card>
        <PlanDialog open={planOpen} onOpenChange={setPlanOpen} plan={null} />
      </div>
    );
  }

  const drift: string[] = [];
  if (goalTargets.calories && plan.calorieTarget && goalTargets.calories !== plan.calorieTarget) {
    drift.push(`calories goal is ${formatValue(goalTargets.calories)} kcal`);
  }
  if (goalTargets.protein && plan.proteinTarget && goalTargets.protein !== plan.proteinTarget) {
    drift.push(`protein goal is ${formatValue(goalTargets.protein)} g`);
  }

  return (
    <div className="space-y-5">
      {header}

      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-xl">{plan.name}</h2>
            {plan.goal ? <p className="text-sm text-muted-foreground">{plan.goal}</p> : null}
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-1">
            {[
              { label: "Calories", value: plan.calorieTarget, unit: "kcal" },
              { label: "Protein", value: plan.proteinTarget, unit: "g" },
              { label: "Carbs", value: plan.carbsTarget, unit: "g" },
              { label: "Fat", value: plan.fatTarget, unit: "g" },
            ]
              .filter((row) => row.value !== null)
              .map((row) => (
                <div key={row.label}>
                  <dt className="text-xs tracking-wide text-muted-foreground uppercase">{row.label}</dt>
                  <dd className="tabular text-lg font-medium">
                    {formatValue(row.value as number)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">{row.unit}</span>
                  </dd>
                </div>
              ))}
          </dl>
        </div>
        {plan.notes ? <p className="border-t pt-3 text-sm text-muted-foreground">{plan.notes}</p> : null}
        {drift.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Plan targets differ from your tracked goals ({drift.join(", ")}).{" "}
            <Link href="/goals" className="underline underline-offset-2">Goals</Link> stay the source of truth for progress.
          </p>
        ) : null}
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Meals</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={showDisabled} onCheckedChange={setShowDisabled} aria-label="Show disabled" />
            Show disabled
          </label>
          <Button size="sm" variant="outline" onClick={() => setMealDialog({ meal: null })}>
            <Plus className="size-3.5" aria-hidden /> Add meal
          </Button>
        </div>
      </div>

      {visibleMeals.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            title="No meals yet."
            description="Add breakfast, lunch, dinner — whatever your day actually looks like."
            action={<Button size="sm" onClick={() => setMealDialog({ meal: null })}>Add a meal</Button>}
          />
        </Card>
      ) : (
        <ul className="space-y-4">
          {visibleMeals.map((meal, index) => {
            const options = meal.options.filter((option) => option.active || showDisabled);
            return (
              <li key={meal.id}>
                <Card className={cn("gap-0 p-0", !meal.active && "opacity-60")}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3">
                    <h3 className="font-medium">
                      {meal.name}
                      {!meal.active ? <span className="ml-2 text-xs text-muted-foreground">disabled</span> : null}
                    </h3>
                    {meal.recommendedTime ? (
                      <span className="tabular text-xs text-muted-foreground">{meal.recommendedTime}</span>
                    ) : null}
                    {meal.calorieTarget || meal.proteinTarget ? (
                      <span className="tabular text-xs text-muted-foreground">
                        {[
                          meal.calorieTarget ? `${formatValue(meal.calorieTarget)} kcal` : null,
                          meal.proteinTarget ? `${formatValue(meal.proteinTarget)} g protein` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                    <div className="ml-auto flex items-center gap-1">
                      <Button variant="ghost" size="icon-sm" disabled={pending || index === 0 || !meal.active} onClick={() => move(meal.id, -1)} aria-label={`Move ${meal.name} up`}>
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" disabled={pending || !meal.active || index === activeMeals.length - 1} onClick={() => move(meal.id, 1)} aria-label={`Move ${meal.name} down`}>
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setMealDialog({ meal })}>
                        <Pencil className="size-3.5" aria-hidden /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => updateDietMealAction({ mealId: meal.id, active: !meal.active }),
                            { success: meal.active ? "Meal disabled" : "Meal restored" },
                          )
                        }
                      >
                        {meal.active ? "Disable" : "Restore"}
                      </Button>
                    </div>
                  </div>

                  {meal.notes ? (
                    <p className="border-b px-4 py-2 text-xs text-muted-foreground">{meal.notes}</p>
                  ) : null}

                  {options.length === 0 ? (
                    <div className="px-4">
                      <EmptyState title="Nothing to eat here yet." description="Add an option." />
                    </div>
                  ) : (
                    <ul className="divide-y">
                      {options.map((option) => (
                        <li key={option.id} className={cn("px-4 py-3", !option.active && "opacity-50")}>
                          <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                            <div className="min-w-0 flex-1">
                              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                {option.isDefault ? (
                                  <Star className="size-3.5 fill-brand text-brand" aria-label="Default" />
                                ) : null}
                                {option.name}
                                {!option.active ? (
                                  <span className="text-xs font-normal text-muted-foreground">removed</span>
                                ) : null}
                              </p>
                              {option.description ? (
                                <p className="text-xs text-muted-foreground">{option.description}</p>
                              ) : null}
                              {option.ingredients.length > 0 ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {option.ingredients.join(" · ")}
                                </p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {option.calories || option.proteinG ? (
                                <span className="tabular text-xs text-muted-foreground">
                                  {[
                                    option.calories ? `≈${formatValue(option.calories)} kcal` : null,
                                    option.proteinG ? `${formatValue(option.proteinG)} g` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </span>
                              ) : null}
                              {option.active ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={pending}
                                  title="Add this to today's food log"
                                  onClick={() =>
                                    run(() => logDietMealOptionAction({ optionId: option.id }), {
                                      success: `Logged ${option.name} to today's food`,
                                    })
                                  }
                                >
                                  <Utensils className="size-3.5" aria-hidden /> Log this
                                </Button>
                              ) : null}
                              {!option.isDefault && option.active ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={pending}
                                  aria-label={`Make ${option.name} the default`}
                                  title="Make this the usual choice"
                                  onClick={() =>
                                    run(
                                      () => updateDietMealOptionAction({ optionId: option.id, isDefault: true }),
                                      { success: `${option.name} is now the default` },
                                    )
                                  }
                                >
                                  <Star className="size-3.5" />
                                </Button>
                              ) : null}
                              <Button variant="ghost" size="icon-sm" onClick={() => setOptionDialog({ meal, option })} aria-label={`Edit ${option.name}`}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={pending}
                                aria-label={option.active ? `Remove ${option.name}` : `Restore ${option.name}`}
                                title={option.active ? "Remove (kept, so it can come back)" : "Restore"}
                                onClick={() =>
                                  run(
                                    () => updateDietMealOptionAction({ optionId: option.id, active: !option.active }),
                                    { success: option.active ? "Option removed" : "Option restored" },
                                  )
                                }
                              >
                                {option.active ? <X className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="border-t px-4 py-2">
                    <Button variant="ghost" size="sm" onClick={() => setOptionDialog({ meal, option: null })}>
                      <Plus className="size-3.5" aria-hidden /> Add an option
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <PlanDialog open={planOpen} onOpenChange={setPlanOpen} plan={plan} />
      <MealDialog
        open={mealDialog !== null}
        onOpenChange={(next) => !next && setMealDialog(null)}
        planId={plan.id}
        meal={mealDialog?.meal ?? null}
      />
      <OptionDialog
        open={optionDialog !== null}
        onOpenChange={(next) => !next && setOptionDialog(null)}
        mealId={optionDialog?.meal.id ?? ""}
        mealName={optionDialog?.meal.name ?? ""}
        option={optionDialog?.option ?? null}
      />
    </div>
  );
}
