/**
 * Writes `INITIAL_DIET_PLAN` for a user, once.
 *
 * Shared by `seed-diet.ts` (the standalone, deployment-safe entry point) and
 * `seed.ts` (the development seed) so both produce an identical plan. Returns
 * null when the user already has one, which is what makes re-running safe.
 */
import type { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { INITIAL_DIET_PLAN } from "../src/lib/diet-seed";

type Db = ReturnType<typeof drizzle<typeof schema>>;

export async function seedDietPlan(db: Db, userId: string): Promise<string | null> {
  const existing = await db.query.dietPlans.findFirst({
    where: eq(schema.dietPlans.userId, userId),
  });
  if (existing) return null;

  const seed = INITIAL_DIET_PLAN;
  const [plan] = await db
    .insert(schema.dietPlans)
    .values({
      userId,
      name: seed.name,
      goal: seed.goal,
      calorieTarget: seed.calorieTarget,
      proteinTarget: seed.proteinTarget,
      notes: seed.notes,
      active: true,
      source: "seed",
    })
    .returning();

  for (const [index, meal] of seed.meals.entries()) {
    const [row] = await db
      .insert(schema.dietMeals)
      .values({
        planId: plan.id,
        name: meal.name,
        mealType: meal.mealType,
        recommendedTime: meal.recommendedTime ?? null,
        calorieTarget: meal.calorieTarget ?? null,
        proteinTarget: meal.proteinTarget ?? null,
        notes: meal.notes ?? null,
        sortOrder: index,
      })
      .returning();

    await db.insert(schema.dietMealOptions).values(
      meal.options.map((option, position) => ({
        mealId: row.id,
        name: option.name,
        description: option.description ?? null,
        ingredients: option.ingredients,
        calories: option.calories ?? null,
        proteinG: option.proteinG ?? null,
        notes: option.notes ?? null,
        isDefault: option.isDefault ?? false,
        sortOrder: position,
      })),
    );
  }
  return plan.name;
}
