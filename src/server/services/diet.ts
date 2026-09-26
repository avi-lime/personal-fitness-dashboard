import "server-only";
import { and, asc, desc, eq, inArray, max, ne } from "drizzle-orm";
import { db } from "@/db";
import { dietMealOptions, dietMeals, dietPlans } from "@/db/schema";
import type { DietMeal, DietMealOption, DietPlan, FoodLog } from "@/db/schema";
import type { EntrySource } from "@/lib/domain";
import { logFood } from "./food";
import type {
  DietMealInput,
  DietMealOptionInput,
  DietMealOptionUpdate,
  DietMealUpdate,
  DietPlanInput,
  DietPlanUpdate,
} from "@/lib/validation";

/**
 * The diet plan: recommendations, never consumption.
 *
 * Every function here changes the plan and nothing else. The single exception
 * is `logDietMealOption` at the bottom, which exists only because the user
 * pressed "Log this meal" — it is the one bridge to `foodLogs`, and it is
 * never called as a side effect of editing the plan.
 */

export interface DietMealView extends DietMeal {
  options: DietMealOption[];
}

export interface DietPlanView {
  plan: DietPlan;
  meals: DietMealView[];
}

// --- Ownership -------------------------------------------------------------

/**
 * Meals and options hang off the plan and carry no `userId` of their own, so
 * every mutation resolves through these: an id belonging to someone else comes
 * back as null and the caller reports "not found".
 */
async function ownedMeal(userId: string, mealId: string): Promise<DietMeal | null> {
  const [row] = await db
    .select({ meal: dietMeals })
    .from(dietMeals)
    .innerJoin(dietPlans, eq(dietMeals.planId, dietPlans.id))
    .where(and(eq(dietMeals.id, mealId), eq(dietPlans.userId, userId)))
    .limit(1);
  return row?.meal ?? null;
}

async function ownedOption(userId: string, optionId: string): Promise<DietMealOption | null> {
  const [row] = await db
    .select({ option: dietMealOptions })
    .from(dietMealOptions)
    .innerJoin(dietMeals, eq(dietMealOptions.mealId, dietMeals.id))
    .innerJoin(dietPlans, eq(dietMeals.planId, dietPlans.id))
    .where(and(eq(dietMealOptions.id, optionId), eq(dietPlans.userId, userId)))
    .limit(1);
  return row?.option ?? null;
}

async function ownedPlan(userId: string, planId: string): Promise<DietPlan | null> {
  const [row] = await db
    .select()
    .from(dietPlans)
    .where(and(eq(dietPlans.id, planId), eq(dietPlans.userId, userId)))
    .limit(1);
  return row ?? null;
}

// --- Reading ---------------------------------------------------------------

export async function listDietPlans(userId: string): Promise<DietPlan[]> {
  return db
    .select()
    .from(dietPlans)
    .where(eq(dietPlans.userId, userId))
    .orderBy(desc(dietPlans.active), asc(dietPlans.name));
}

/** The whole plan in display order. Inactive meals and options are optional. */
export async function getDietPlan(
  userId: string,
  options: { planId?: string; includeInactive?: boolean } = {},
): Promise<DietPlanView | null> {
  const plan = options.planId
    ? await ownedPlan(userId, options.planId)
    : ((
        await db
          .select()
          .from(dietPlans)
          .where(and(eq(dietPlans.userId, userId), eq(dietPlans.active, true)))
          .orderBy(desc(dietPlans.updatedAt))
          .limit(1)
      )[0] ?? null);
  if (!plan) return null;

  const mealFilters = [eq(dietMeals.planId, plan.id)];
  if (!options.includeInactive) mealFilters.push(eq(dietMeals.active, true));
  const meals = await db
    .select()
    .from(dietMeals)
    .where(and(...mealFilters))
    .orderBy(asc(dietMeals.sortOrder), asc(dietMeals.createdAt));
  if (meals.length === 0) return { plan, meals: [] };

  const rows = await db
    .select()
    .from(dietMealOptions)
    .where(inArray(dietMealOptions.mealId, meals.map((meal) => meal.id)))
    .orderBy(desc(dietMealOptions.isDefault), asc(dietMealOptions.sortOrder), asc(dietMealOptions.createdAt));
  const byMeal = new Map<string, DietMealOption[]>();
  for (const option of rows) {
    if (!options.includeInactive && !option.active) continue;
    const list = byMeal.get(option.mealId);
    if (list) list.push(option);
    else byMeal.set(option.mealId, [option]);
  }

  return { plan, meals: meals.map((meal) => ({ ...meal, options: byMeal.get(meal.id) ?? [] })) };
}

export const getDietMeal = ownedMeal;
export const getDietMealOption = ownedOption;

// --- Plans -----------------------------------------------------------------

/** Creates a plan and makes it the active one, since only one can be active. */
export async function createDietPlan(
  userId: string,
  input: DietPlanInput,
  source: EntrySource = "web",
): Promise<DietPlan> {
  return db.transaction(async (tx) => {
    await tx.update(dietPlans).set({ active: false }).where(eq(dietPlans.userId, userId));
    const [created] = await tx
      .insert(dietPlans)
      .values({
        userId,
        name: input.name,
        goal: input.goal ?? null,
        calorieTarget: input.calorieTarget ?? null,
        proteinTarget: input.proteinTarget ?? null,
        carbsTarget: input.carbsTarget ?? null,
        fatTarget: input.fatTarget ?? null,
        notes: input.notes ?? null,
        active: true,
        source,
      })
      .returning();
    return created;
  });
}

export async function updateDietPlan(
  userId: string,
  planId: string,
  patch: DietPlanUpdate,
): Promise<DietPlan | null> {
  const changes: Partial<typeof dietPlans.$inferInsert> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.goal !== undefined) changes.goal = patch.goal ?? null;
  if (patch.calorieTarget !== undefined) changes.calorieTarget = patch.calorieTarget ?? null;
  if (patch.proteinTarget !== undefined) changes.proteinTarget = patch.proteinTarget ?? null;
  if (patch.carbsTarget !== undefined) changes.carbsTarget = patch.carbsTarget ?? null;
  if (patch.fatTarget !== undefined) changes.fatTarget = patch.fatTarget ?? null;
  if (patch.notes !== undefined) changes.notes = patch.notes ?? null;
  if (patch.active !== undefined) changes.active = patch.active;
  if (Object.keys(changes).length === 0) return ownedPlan(userId, planId);

  return db.transaction(async (tx) => {
    const [plan] = await tx
      .select()
      .from(dietPlans)
      .where(and(eq(dietPlans.id, planId), eq(dietPlans.userId, userId)))
      .limit(1);
    if (!plan) return null;
    // Activating one plan stands the others down, so "the plan" is unambiguous.
    if (changes.active === true) {
      await tx
        .update(dietPlans)
        .set({ active: false })
        .where(and(eq(dietPlans.userId, userId), ne(dietPlans.id, planId)));
    }
    const [updated] = await tx
      .update(dietPlans)
      .set(changes)
      .where(eq(dietPlans.id, planId))
      .returning();
    return updated;
  });
}

export async function deleteDietPlan(userId: string, planId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(dietPlans)
    .where(and(eq(dietPlans.id, planId), eq(dietPlans.userId, userId)))
    .returning({ id: dietPlans.id });
  return Boolean(deleted);
}

// --- Meals -----------------------------------------------------------------

export async function addDietMeal(
  userId: string,
  planId: string,
  input: DietMealInput,
): Promise<DietMeal | null> {
  const plan = await ownedPlan(userId, planId);
  if (!plan) return null;
  const [{ value } = { value: null }] = await db
    .select({ value: max(dietMeals.sortOrder) })
    .from(dietMeals)
    .where(eq(dietMeals.planId, planId));
  const [created] = await db
    .insert(dietMeals)
    .values({
      planId,
      name: input.name,
      recommendedTime: input.recommendedTime ?? null,
      mealType: input.mealType,
      calorieTarget: input.calorieTarget ?? null,
      proteinTarget: input.proteinTarget ?? null,
      notes: input.notes ?? null,
      sortOrder: input.sortOrder ?? (value ?? -1) + 1,
    })
    .returning();
  return created;
}

export async function updateDietMeal(
  userId: string,
  mealId: string,
  patch: DietMealUpdate,
): Promise<DietMeal | null> {
  const meal = await ownedMeal(userId, mealId);
  if (!meal) return null;
  const changes: Partial<typeof dietMeals.$inferInsert> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.recommendedTime !== undefined) changes.recommendedTime = patch.recommendedTime ?? null;
  if (patch.mealType !== undefined) changes.mealType = patch.mealType;
  if (patch.calorieTarget !== undefined) changes.calorieTarget = patch.calorieTarget ?? null;
  if (patch.proteinTarget !== undefined) changes.proteinTarget = patch.proteinTarget ?? null;
  if (patch.notes !== undefined) changes.notes = patch.notes ?? null;
  if (patch.sortOrder !== undefined && patch.sortOrder !== null) changes.sortOrder = patch.sortOrder;
  if (patch.active !== undefined) changes.active = patch.active;
  if (Object.keys(changes).length === 0) return meal;

  const [updated] = await db
    .update(dietMeals)
    .set(changes)
    .where(eq(dietMeals.id, mealId))
    .returning();
  return updated;
}

/** Writes `sortOrder` from the given order. Meals left out keep their place after them. */
export async function reorderDietMeals(
  userId: string,
  planId: string,
  mealIds: string[],
): Promise<DietMeal[] | null> {
  const plan = await ownedPlan(userId, planId);
  if (!plan) return null;
  await db.transaction(async (tx) => {
    const owned = await tx.select({ id: dietMeals.id }).from(dietMeals).where(eq(dietMeals.planId, planId));
    const ids = new Set(owned.map((row) => row.id));
    let order = 0;
    for (const mealId of mealIds) {
      if (!ids.has(mealId)) continue;
      await tx.update(dietMeals).set({ sortOrder: order }).where(eq(dietMeals.id, mealId));
      order += 1;
    }
    for (const row of owned) {
      if (mealIds.includes(row.id)) continue;
      await tx.update(dietMeals).set({ sortOrder: order }).where(eq(dietMeals.id, row.id));
      order += 1;
    }
  });
  return db
    .select()
    .from(dietMeals)
    .where(eq(dietMeals.planId, planId))
    .orderBy(asc(dietMeals.sortOrder));
}

// --- Options ---------------------------------------------------------------

export async function addDietMealOption(
  userId: string,
  mealId: string,
  input: DietMealOptionInput,
): Promise<DietMealOption | null> {
  const meal = await ownedMeal(userId, mealId);
  if (!meal) return null;
  return db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx.update(dietMealOptions).set({ isDefault: false }).where(eq(dietMealOptions.mealId, mealId));
    }
    const [{ value } = { value: null }] = await tx
      .select({ value: max(dietMealOptions.sortOrder) })
      .from(dietMealOptions)
      .where(eq(dietMealOptions.mealId, mealId));
    const [created] = await tx
      .insert(dietMealOptions)
      .values({
        mealId,
        name: input.name,
        description: input.description ?? null,
        ingredients: input.ingredients,
        calories: input.calories ?? null,
        proteinG: input.proteinG ?? null,
        carbsG: input.carbsG ?? null,
        fatG: input.fatG ?? null,
        notes: input.notes ?? null,
        isDefault: input.isDefault,
        sortOrder: (value ?? -1) + 1,
      })
      .returning();
    return created;
  });
}

export async function updateDietMealOption(
  userId: string,
  optionId: string,
  patch: DietMealOptionUpdate,
): Promise<DietMealOption | null> {
  const option = await ownedOption(userId, optionId);
  if (!option) return null;
  const changes: Partial<typeof dietMealOptions.$inferInsert> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.description !== undefined) changes.description = patch.description ?? null;
  if (patch.ingredients !== undefined) changes.ingredients = patch.ingredients;
  if (patch.calories !== undefined) changes.calories = patch.calories ?? null;
  if (patch.proteinG !== undefined) changes.proteinG = patch.proteinG ?? null;
  if (patch.carbsG !== undefined) changes.carbsG = patch.carbsG ?? null;
  if (patch.fatG !== undefined) changes.fatG = patch.fatG ?? null;
  if (patch.notes !== undefined) changes.notes = patch.notes ?? null;
  if (patch.isDefault !== undefined) changes.isDefault = patch.isDefault;
  if (patch.active !== undefined) changes.active = patch.active;
  if (Object.keys(changes).length === 0) return option;

  return db.transaction(async (tx) => {
    if (changes.isDefault === true) {
      await tx
        .update(dietMealOptions)
        .set({ isDefault: false })
        .where(and(eq(dietMealOptions.mealId, option.mealId), ne(dietMealOptions.id, optionId)));
    }
    const [updated] = await tx
      .update(dietMealOptions)
      .set(changes)
      .where(eq(dietMealOptions.id, optionId))
      .returning();
    return updated;
  });
}

/** Soft removal: the option is kept so it can be brought back. */
export async function setDietMealOptionActive(
  userId: string,
  optionId: string,
  active: boolean,
): Promise<DietMealOption | null> {
  return updateDietMealOption(userId, optionId, { active });
}

// --- The one bridge to the food log ---------------------------------------

/**
 * Writes today's food log from a planned option, because the user asked for it.
 *
 * A planned option's macros are estimates by construction, so the entry is
 * stored with `estimated: true` and the UI shows it with "≈" like any other
 * estimate. The plan itself is not modified.
 */
export async function logDietMealOption(
  userId: string,
  timezone: string,
  optionId: string,
  source: EntrySource = "web",
): Promise<FoodLog | null> {
  const option = await ownedOption(userId, optionId);
  if (!option) return null;
  const meal = await ownedMeal(userId, option.mealId);
  return logFood(
    userId,
    timezone,
    {
      name: option.name,
      calories: option.calories ?? 0,
      proteinG: option.proteinG ?? null,
      carbsG: option.carbsG ?? null,
      fatG: option.fatG ?? null,
      quantity: 1,
      unit: "serving",
      mealType: meal?.mealType ?? "other",
      notes: option.description ?? null,
      occurredAt: null,
      foodId: null,
      estimated: true,
    },
    source,
  );
}
