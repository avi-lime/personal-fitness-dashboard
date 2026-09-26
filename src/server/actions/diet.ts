"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import {
  dietMealInputSchema,
  dietMealOptionInputSchema,
  dietMealOptionUpdateSchema,
  dietMealUpdateSchema,
  dietPlanInputSchema,
  dietPlanUpdateSchema,
  uuidSchema,
} from "@/lib/validation";
import {
  addDietMeal,
  addDietMealOption,
  createDietPlan,
  logDietMealOption,
  reorderDietMeals,
  updateDietMeal,
  updateDietMealOption,
  updateDietPlan,
} from "@/server/services/diet";
import { revalidateAll, withValidation } from "./helpers";

export async function createDietPlanAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(dietPlanInputSchema, input, async (value, ctx) => {
    await createDietPlan(ctx.user.id, value);
    revalidateAll();
    return ok();
  });
}

const planUpdateSchema = dietPlanUpdateSchema.extend({ planId: uuidSchema });

export async function updateDietPlanAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(planUpdateSchema, input, async ({ planId, ...patch }, ctx) => {
    const updated = await updateDietPlan(ctx.user.id, planId, patch);
    if (!updated) return fail("Diet plan not found");
    revalidateAll();
    return ok();
  });
}

const mealCreateSchema = dietMealInputSchema.extend({ planId: uuidSchema });

export async function addDietMealAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(mealCreateSchema, input, async ({ planId, ...value }, ctx) => {
    const meal = await addDietMeal(ctx.user.id, planId, value);
    if (!meal) return fail("Diet plan not found");
    revalidateAll();
    return ok();
  });
}

const mealUpdateSchema = dietMealUpdateSchema.extend({ mealId: uuidSchema });

export async function updateDietMealAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(mealUpdateSchema, input, async ({ mealId, ...patch }, ctx) => {
    const updated = await updateDietMeal(ctx.user.id, mealId, patch);
    if (!updated) return fail("Meal not found");
    revalidateAll();
    return ok();
  });
}

const optionCreateSchema = dietMealOptionInputSchema.extend({ mealId: uuidSchema });

export async function addDietMealOptionAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(optionCreateSchema, input, async ({ mealId, ...value }, ctx) => {
    const option = await addDietMealOption(ctx.user.id, mealId, value);
    if (!option) return fail("Meal not found");
    revalidateAll();
    return ok();
  });
}

const optionUpdateSchema = dietMealOptionUpdateSchema.extend({ optionId: uuidSchema });

export async function updateDietMealOptionAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(optionUpdateSchema, input, async ({ optionId, ...patch }, ctx) => {
    const updated = await updateDietMealOption(ctx.user.id, optionId, patch);
    if (!updated) return fail("Meal option not found");
    revalidateAll();
    return ok();
  });
}

const reorderSchema = z.object({ planId: uuidSchema, mealIds: z.array(uuidSchema).min(1) });

export async function reorderDietMealsAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(reorderSchema, input, async (value, ctx) => {
    const meals = await reorderDietMeals(ctx.user.id, value.planId, value.mealIds);
    if (!meals) return fail("Diet plan not found");
    revalidateAll();
    return ok();
  });
}

const logOptionSchema = z.object({ optionId: uuidSchema });

/**
 * The plan-to-food-log bridge, and it only ever runs because the user pressed
 * "Log this meal". Editing the plan never reaches this.
 */
export async function logDietMealOptionAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(logOptionSchema, input, async (value, ctx) => {
    const logged = await logDietMealOption(ctx.user.id, ctx.timezone, value.optionId);
    if (!logged) return fail("Meal option not found");
    revalidateAll();
    return ok();
  });
}
