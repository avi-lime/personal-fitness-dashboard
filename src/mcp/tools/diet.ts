import "server-only";
import { defineTool } from "../registry";
import { recordMutation } from "../audit";
import { ToolFailure } from "./write";
import { findOneByName } from "./match";
import * as schemas from "../schemas";
import {
  addDietMeal,
  addDietMealOption,
  createDietPlan,
  getDietPlan,
  reorderDietMeals,
  updateDietMeal,
  updateDietMealOption,
  updateDietPlan,
  type DietMealView,
  type DietPlanView,
} from "@/server/services/diet";
import { listGoals, toGoalLike } from "@/server/services/goals";
import type { DietMeal, DietMealOption, DietPlan } from "@/db/schema";
import type { McpContext } from "../context";

/**
 * Diet-plan tools. These change what the user *plans* to eat and never touch
 * the food log — logging what was actually eaten stays with `log_food`, so the
 * two can never be confused for one another.
 */

function optionView(option: DietMealOption) {
  return {
    id: option.id,
    name: option.name,
    description: option.description,
    ingredients: option.ingredients,
    calories: option.calories,
    proteinG: option.proteinG,
    carbsG: option.carbsG,
    fatG: option.fatG,
    notes: option.notes,
    isDefault: option.isDefault,
    active: option.active,
  };
}

function mealView(meal: DietMealView) {
  return {
    id: meal.id,
    name: meal.name,
    recommendedTime: meal.recommendedTime,
    mealType: meal.mealType,
    calorieTarget: meal.calorieTarget,
    proteinTarget: meal.proteinTarget,
    notes: meal.notes,
    active: meal.active,
    options: meal.options.map(optionView),
  };
}

function planView(plan: DietPlan) {
  return {
    id: plan.id,
    name: plan.name,
    goal: plan.goal,
    calorieTarget: plan.calorieTarget,
    proteinTarget: plan.proteinTarget,
    carbsTarget: plan.carbsTarget,
    fatTarget: plan.fatTarget,
    notes: plan.notes,
    active: plan.active,
    updatedAt: plan.updatedAt.toISOString(),
  };
}

/** Every tool needs the plan; a missing one is an actionable message, not an empty object. */
async function requirePlan(ctx: McpContext, planId?: string): Promise<DietPlanView> {
  const view = await getDietPlan(ctx.userId, { planId, includeInactive: true });
  if (!view) {
    throw new ToolFailure(
      planId
        ? `No diet plan with id ${planId}.`
        : "There is no diet plan yet. Create one with add_diet_plan first.",
    );
  }
  return view;
}

function resolveMeal(view: DietPlanView, mealId?: string, name?: string): DietMealView {
  if (mealId) {
    const meal = view.meals.find((entry) => entry.id === mealId);
    if (!meal) throw new ToolFailure(`No meal with id ${mealId} in "${view.plan.name}".`);
    return meal;
  }
  return findOneByName(view.meals, name ?? "", (meal) => meal.name, "meal");
}

function resolveOption(
  view: DietPlanView,
  args: { optionId?: string; option?: string; meal?: string },
): { meal: DietMealView; option: DietMealOption } {
  const meals = args.meal ? [resolveMeal(view, undefined, args.meal)] : view.meals;
  if (args.optionId) {
    for (const meal of meals) {
      const option = meal.options.find((entry) => entry.id === args.optionId);
      if (option) return { meal, option };
    }
    throw new ToolFailure(`No meal option with id ${args.optionId}.`);
  }
  const flat = meals.flatMap((meal) => meal.options.map((option) => ({ meal, option })));
  return findOneByName(flat, args.option ?? "", (entry) => entry.option.name, "meal option");
}

/** Daily nutrition goals, so the plan's targets can be compared instead of duplicated. */
async function nutritionGoals(ctx: McpContext) {
  const goals = (await listGoals(ctx.userId, false)).map(toGoalLike);
  const daily = (metric: string) =>
    goals.find((goal) => goal.metricKey === metric && goal.period === "daily")?.targetValue ?? null;
  return { calories: daily("calories"), proteinG: daily("protein") };
}

function targetLine(plan: DietPlan): string {
  const parts: string[] = [];
  if (plan.calorieTarget) parts.push(`${plan.calorieTarget} kcal`);
  if (plan.proteinTarget) parts.push(`${plan.proteinTarget} g protein`);
  return parts.length > 0 ? ` Targets: ${parts.join(", ")}.` : "";
}

export const dietTools = [
  defineTool({
    name: "get_diet_plan",
    title: "Get diet plan",
    kind: "read",
    input: schemas.getDietPlanInput,
    description:
      "The user's diet plan: daily calorie and protein targets, every meal in order with its recommended time and targets, and each meal's options (the default one plus alternatives) with ingredients and estimated macros. This is what the user PLANS to eat — use get_food_log for what they actually ate. Call this before changing anything about the plan.",
    async run(ctx, args) {
      const view = await getDietPlan(ctx.userId, {
        planId: args.planId,
        includeInactive: args.includeInactive ?? false,
      });
      if (!view) {
        return {
          summary: "No diet plan has been created yet.",
          data: { plan: null, meals: [], nutritionGoals: await nutritionGoals(ctx) },
        };
      }
      const options = view.meals.reduce((total, meal) => total + meal.options.length, 0);
      return {
        summary: `Diet plan "${view.plan.name}": ${view.meals.length} meal(s), ${options} option(s).${targetLine(view.plan)}`,
        data: {
          plan: planView(view.plan),
          meals: view.meals.map(mealView),
          /** The goals system stays the source of truth for tracking. */
          nutritionGoals: await nutritionGoals(ctx),
        },
      };
    },
  }),
  defineTool({
    name: "add_diet_plan",
    title: "Add diet plan",
    kind: "write",
    input: schemas.addDietPlanInput,
    description:
      "Creates a diet plan and makes it the one in use (any previous plan is kept but stood down). Add its meals with add_diet_meal afterwards. Does not create goals and does not log any food.",
    async run(ctx, args) {
      const plan = await createDietPlan(ctx.userId, { ...args }, ctx.source);
      const summary = `Created diet plan "${plan.name}" and made it active.${targetLine(plan)}`;
      await recordMutation(ctx.userId, "add_diet_plan", args, summary, ctx.source);
      return { summary, data: planView(plan) };
    },
  }),
  defineTool({
    name: "update_diet_plan",
    title: "Update diet plan",
    kind: "write",
    input: schemas.updateDietPlanInput,
    description:
      "Changes the plan itself: name, goal, daily calorie/protein/carb/fat targets, notes, or which plan is active. Only the fields you pass change. This does not log food and does not change the user's goals — if they also want the tracked goal updated, use update_goal as well.",
    async run(ctx, args) {
      const { planId, ...patch } = args;
      const view = await requirePlan(ctx, planId);
      const updated = await updateDietPlan(ctx.userId, view.plan.id, patch);
      if (!updated) throw new ToolFailure("Diet plan not found.");
      const summary = `Updated diet plan "${updated.name}".${targetLine(updated)}`;
      await recordMutation(ctx.userId, "update_diet_plan", args, summary, ctx.source);
      return { summary, data: planView(updated) };
    },
  }),
  defineTool({
    name: "add_diet_meal",
    title: "Add meal to the diet plan",
    kind: "write",
    input: schemas.addDietMealInput,
    description:
      "Adds a meal slot to the plan (breakfast, pre-workout, dinner…), appended at the end. Add the things the user can eat for it with add_diet_meal_option.",
    async run(ctx, args) {
      const { planId, ...input } = args;
      const view = await requirePlan(ctx, planId);
      const meal = await addDietMeal(ctx.userId, view.plan.id, {
        ...input,
        mealType: input.mealType ?? "other",
        sortOrder: null,
      });
      if (!meal) throw new ToolFailure("Diet plan not found.");
      const summary = `Added "${meal.name}" to diet plan "${view.plan.name}".`;
      await recordMutation(ctx.userId, "add_diet_meal", args, summary, ctx.source);
      return { summary, data: mealView({ ...meal, options: [] }) };
    },
  }),
  defineTool({
    name: "update_diet_meal",
    title: "Update a diet-plan meal",
    kind: "write",
    input: schemas.updateDietMealInput,
    description:
      "Changes one meal: its name, recommended time, calorie/protein target, notes, or whether it is part of the plan at all (active:false drops it, keeping its options). Identify it by mealId or by name.",
    async run(ctx, args) {
      const { mealId, meal: mealName, ...patch } = args;
      const view = await requirePlan(ctx);
      const meal = resolveMeal(view, mealId, mealName);
      const updated = await updateDietMeal(ctx.userId, meal.id, patch);
      if (!updated) throw new ToolFailure("Meal not found.");
      const summary =
        patch.active === false
          ? `Dropped "${updated.name}" from the diet plan.`
          : `Updated "${updated.name}" in the diet plan.`;
      await recordMutation(ctx.userId, "update_diet_meal", args, summary, ctx.source);
      return { summary, data: mealView({ ...updated, options: meal.options }) };
    },
  }),
  defineTool({
    name: "add_diet_meal_option",
    title: "Add a meal option",
    kind: "write",
    input: schemas.addDietMealOptionInput,
    description:
      'Adds something the user can eat for a meal — one of the alternatives in a rotation, e.g. "Chicken + rice" for dinner. Ingredients are plain lines with quantities. Macros are planning estimates; leave them out if unknown rather than inventing precise numbers.',
    async run(ctx, args) {
      const { mealId, meal: mealName, ...input } = args;
      const view = await requirePlan(ctx);
      const meal = resolveMeal(view, mealId, mealName);
      const option = await addDietMealOption(ctx.userId, meal.id, {
        ...input,
        ingredients: input.ingredients ?? [],
        isDefault: input.isDefault ?? false,
      });
      if (!option) throw new ToolFailure("Meal not found.");
      const summary = `Added "${option.name}" to ${meal.name}${option.isDefault ? " as the default" : ""}.`;
      await recordMutation(ctx.userId, "add_diet_meal_option", args, summary, ctx.source);
      return { summary, data: optionView(option) };
    },
  }),
  defineTool({
    name: "update_diet_meal_option",
    title: "Update a meal option",
    kind: "write",
    input: schemas.updateDietMealOptionInput,
    description:
      "Edits one meal option: name, description, ingredients, estimated macros, notes, whether it is the default for its meal, or whether it is active. Identify it by optionId, or by name (optionally narrowed with the meal name).",
    async run(ctx, args) {
      const { optionId, option: optionName, meal: mealName, ...patch } = args;
      const view = await requirePlan(ctx);
      const { meal, option } = resolveOption(view, { optionId, option: optionName, meal: mealName });
      const updated = await updateDietMealOption(ctx.userId, option.id, patch);
      if (!updated) throw new ToolFailure("Meal option not found.");
      const summary = `Updated "${updated.name}" in ${meal.name}.`;
      await recordMutation(ctx.userId, "update_diet_meal_option", args, summary, ctx.source);
      return { summary, data: optionView(updated) };
    },
  }),
  defineTool({
    name: "remove_diet_meal_option",
    title: "Remove a meal option",
    kind: "write",
    input: schemas.removeDietMealOptionInput,
    description:
      'Takes an option out of the plan — use this when the user says they do not want something any more. It is disabled rather than deleted, so pass restore:true to bring it back. Identify it by optionId, or by name (optionally narrowed with the meal name).',
    async run(ctx, args) {
      const view = await requirePlan(ctx);
      const { meal, option } = resolveOption(view, args);
      const active = args.restore === true;
      const updated = await updateDietMealOption(ctx.userId, option.id, { active });
      if (!updated) throw new ToolFailure("Meal option not found.");
      const summary = active
        ? `Restored "${updated.name}" to ${meal.name}.`
        : `Removed "${updated.name}" from ${meal.name}. It is kept, disabled, so it can be restored.`;
      await recordMutation(ctx.userId, "remove_diet_meal_option", args, summary, ctx.source);
      return { summary, data: optionView(updated) };
    },
  }),
  defineTool({
    name: "reorder_diet_meals",
    title: "Reorder diet-plan meals",
    kind: "write",
    input: schemas.reorderDietMealsInput,
    description:
      "Sets the order meals appear in through the day. Pass the meal names (or ids) in the order you want; any meal you leave out keeps its place after the ones you listed.",
    async run(ctx, args) {
      const view = await requirePlan(ctx, args.planId);
      const ids = args.meals.map((entry) => resolveMeal(view, undefined, entry).id);
      const meals = await reorderDietMeals(ctx.userId, view.plan.id, ids);
      if (!meals) throw new ToolFailure("Diet plan not found.");
      const summary = `Reordered the plan: ${meals.map((meal: DietMeal) => meal.name).join(" → ")}.`;
      await recordMutation(ctx.userId, "reorder_diet_meals", args, summary, ctx.source);
      return { summary, data: { meals: meals.map((meal) => ({ id: meal.id, name: meal.name })) } };
    },
  }),
];
