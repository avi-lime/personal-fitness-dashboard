import "server-only";
import { and, asc, eq, ilike, inArray } from "drizzle-orm";
import { db } from "@/db";
import { foodLogs, foods, mealTemplateItems, mealTemplates } from "@/db/schema";
import type { Food, FoodLog } from "@/db/schema";
import type { EntrySource, MealType } from "@/lib/domain";
import type { FoodLogInput } from "@/lib/validation";
import type { LocalDate } from "@/lib/date";
import { eventTiming } from "./common";

export { sumNutrition } from "@/lib/nutrition";
export type { NutritionTotals } from "@/lib/nutrition";

export async function listFoodLogs(userId: string, date: LocalDate): Promise<FoodLog[]> {
  return db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), eq(foodLogs.localDate, date)))
    .orderBy(asc(foodLogs.occurredAt));
}

export async function logFood(
  userId: string,
  timezone: string,
  input: FoodLogInput,
  source: EntrySource = "web",
): Promise<FoodLog> {
  const { occurredAt, localDate } = eventTiming(timezone, input.occurredAt);
  const [created] = await db
    .insert(foodLogs)
    .values({
      userId,
      foodId: input.foodId ?? null,
      name: input.name,
      calories: input.calories,
      proteinG: input.proteinG ?? null,
      carbsG: input.carbsG ?? null,
      fatG: input.fatG ?? null,
      quantity: input.quantity,
      unit: input.unit,
      mealType: input.mealType,
      notes: input.notes ?? null,
      occurredAt,
      localDate,
      source,
    })
    .returning();
  return created;
}

export async function updateFoodLog(
  userId: string,
  logId: string,
  input: FoodLogInput,
  timezone: string,
): Promise<FoodLog | null> {
  const { occurredAt, localDate } = eventTiming(timezone, input.occurredAt);
  const [updated] = await db
    .update(foodLogs)
    .set({
      name: input.name,
      calories: input.calories,
      proteinG: input.proteinG ?? null,
      carbsG: input.carbsG ?? null,
      fatG: input.fatG ?? null,
      quantity: input.quantity,
      unit: input.unit,
      mealType: input.mealType,
      notes: input.notes ?? null,
      occurredAt,
      localDate,
    })
    .where(and(eq(foodLogs.id, logId), eq(foodLogs.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function deleteFoodLog(userId: string, logId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(foodLogs)
    .where(and(eq(foodLogs.id, logId), eq(foodLogs.userId, userId)))
    .returning({ id: foodLogs.id });
  return Boolean(deleted);
}

/** Copies an entry to now — the fastest way to log a repeated meal. */
export async function duplicateFoodLog(
  userId: string,
  logId: string,
  timezone: string,
): Promise<FoodLog | null> {
  const original = await db.query.foodLogs.findFirst({
    where: and(eq(foodLogs.id, logId), eq(foodLogs.userId, userId)),
  });
  if (!original) return null;
  const { occurredAt, localDate } = eventTiming(timezone);
  const [created] = await db
    .insert(foodLogs)
    .values({
      userId,
      foodId: original.foodId,
      name: original.name,
      calories: original.calories,
      proteinG: original.proteinG,
      carbsG: original.carbsG,
      fatG: original.fatG,
      quantity: original.quantity,
      unit: original.unit,
      mealType: original.mealType,
      notes: original.notes,
      occurredAt,
      localDate,
      source: "web",
    })
    .returning();
  return created;
}

// --- Reusable foods --------------------------------------------------------

export async function listFoods(userId: string, search?: string): Promise<Food[]> {
  const where = search
    ? and(eq(foods.userId, userId), ilike(foods.name, `%${search}%`))
    : eq(foods.userId, userId);
  return db.select().from(foods).where(where).orderBy(asc(foods.name));
}

export async function upsertFood(
  userId: string,
  input: {
    name: string;
    calories: number;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    servingQuantity: number;
    servingUnit: string;
  },
): Promise<Food> {
  const [saved] = await db
    .insert(foods)
    .values({
      userId,
      name: input.name,
      calories: input.calories,
      proteinG: input.proteinG ?? null,
      carbsG: input.carbsG ?? null,
      fatG: input.fatG ?? null,
      servingQuantity: input.servingQuantity,
      servingUnit: input.servingUnit,
    })
    .onConflictDoUpdate({
      target: [foods.userId, foods.name],
      set: {
        calories: input.calories,
        proteinG: input.proteinG ?? null,
        carbsG: input.carbsG ?? null,
        fatG: input.fatG ?? null,
        servingQuantity: input.servingQuantity,
        servingUnit: input.servingUnit,
      },
    })
    .returning();
  return saved;
}

export async function deleteFood(userId: string, foodId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(foods)
    .where(and(eq(foods.id, foodId), eq(foods.userId, userId)))
    .returning({ id: foods.id });
  return Boolean(deleted);
}

// --- Meal templates --------------------------------------------------------

export async function listMealTemplates(userId: string) {
  return db.query.mealTemplates.findMany({
    where: eq(mealTemplates.userId, userId),
    with: { items: { orderBy: [asc(mealTemplateItems.sortOrder)] } },
    orderBy: [asc(mealTemplates.name)],
  });
}

export async function createMealTemplateFromDay(
  userId: string,
  name: string,
  mealType: MealType,
  logIds: string[],
): Promise<string | null> {
  if (logIds.length === 0) return null;
  const selected = await db
    .select()
    .from(foodLogs)
    .where(and(eq(foodLogs.userId, userId), inArray(foodLogs.id, logIds)))
    .orderBy(asc(foodLogs.occurredAt));
  if (selected.length === 0) return null;

  return db.transaction(async (tx) => {
    const [template] = await tx
      .insert(mealTemplates)
      .values({ userId, name, mealType })
      .onConflictDoUpdate({
        target: [mealTemplates.userId, mealTemplates.name],
        set: { mealType },
      })
      .returning();
    await tx.delete(mealTemplateItems).where(eq(mealTemplateItems.templateId, template.id));
    await tx.insert(mealTemplateItems).values(
      selected.map((entry, index) => ({
        templateId: template.id,
        foodId: entry.foodId,
        name: entry.name,
        calories: entry.calories,
        proteinG: entry.proteinG,
        carbsG: entry.carbsG,
        fatG: entry.fatG,
        quantity: entry.quantity,
        unit: entry.unit,
        sortOrder: index,
      })),
    );
    return template.id;
  });
}

export async function applyMealTemplate(
  userId: string,
  templateId: string,
  timezone: string,
): Promise<number> {
  const template = await db.query.mealTemplates.findFirst({
    where: and(eq(mealTemplates.id, templateId), eq(mealTemplates.userId, userId)),
    with: { items: { orderBy: [asc(mealTemplateItems.sortOrder)] } },
  });
  if (!template || template.items.length === 0) return 0;

  const { occurredAt, localDate } = eventTiming(timezone);
  await db.insert(foodLogs).values(
    template.items.map((item) => ({
      userId,
      foodId: item.foodId,
      name: item.name,
      calories: item.calories,
      proteinG: item.proteinG,
      carbsG: item.carbsG,
      fatG: item.fatG,
      quantity: item.quantity,
      unit: item.unit,
      mealType: template.mealType,
      occurredAt,
      localDate,
      source: "web" as const,
    })),
  );
  return template.items.length;
}

export async function deleteMealTemplate(userId: string, templateId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(mealTemplates)
    .where(and(eq(mealTemplates.id, templateId), eq(mealTemplates.userId, userId)))
    .returning({ id: mealTemplates.id });
  return Boolean(deleted);
}
