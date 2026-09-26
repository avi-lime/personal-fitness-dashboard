import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { dietPlans, foodLogs, profiles, users } from "@/db/schema";
import type { McpContext } from "@/mcp/context";
import { toolByName } from "@/mcp/registry";
import { ToolFailure } from "@/mcp/tools/write";
import { logDietMealOption } from "@/server/services/diet";
import { logFood } from "@/server/services/food";

/**
 * The diet plan through its tools, against a real database.
 *
 * Two users exist so the ownership assertions mean something, and the plan /
 * food-log boundary is asserted in both directions: editing the plan must
 * never write a food log, and logging food must never touch the plan.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const TODAY = "2026-09-26";

async function createUser(label: string): Promise<McpContext> {
  const username = `vitest-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db.insert(users).values({ username }).returning();
  await db.insert(profiles).values({ userId: user.id, timezone: "UTC" });
  return { userId: user.id, timezone: "UTC", today: TODAY, source: "assistant" };
}

const call = (name: string, ctx: McpContext, args: Record<string, unknown> = {}) => {
  const tool = toolByName.get(name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.run(ctx, tool.input.parse(args));
};

interface PlanData {
  plan: { id: string; name: string; calorieTarget: number | null; proteinTarget: number | null } | null;
  meals: Array<{
    id: string;
    name: string;
    calorieTarget: number | null;
    proteinTarget: number | null;
    options: Array<{ id: string; name: string; isDefault: boolean; active: boolean; ingredients: string[] }>;
  }>;
  nutritionGoals: { calories: number | null; proteinG: number | null };
}

const read = async (ctx: McpContext, args: Record<string, unknown> = {}): Promise<PlanData> =>
  (await call("get_diet_plan", ctx, args)).data as PlanData;

suite("diet plan tools", () => {
  let alice: McpContext;
  let bob: McpContext;

  beforeAll(async () => {
    alice = await createUser("diet-alice");
    bob = await createUser("diet-bob");
  });

  afterAll(async () => {
    if (alice) await db.delete(users).where(eq(users.id, alice.userId));
    if (bob) await db.delete(users).where(eq(users.id, bob.userId));
  });

  it("reports no plan before one exists, and refuses edits until there is", async () => {
    const empty = await read(alice);
    expect(empty.plan).toBeNull();
    expect(empty.meals).toEqual([]);
    await expect(call("add_diet_meal", alice, { name: "Breakfast" })).rejects.toBeInstanceOf(ToolFailure);
  });

  it("creates a plan with targets and makes it the active one", async () => {
    const created = await call("add_diet_plan", alice, {
      name: "Lean Muscle Gain",
      goal: "Reach at least 57 kg while building lean muscle",
      calorieTarget: 2200,
      proteinTarget: 150,
    });
    expect(created.summary).toContain("Lean Muscle Gain");
    expect(created.summary).toContain("2200 kcal");

    const view = await read(alice);
    expect(view.plan?.name).toBe("Lean Muscle Gain");
    expect(view.plan?.calorieTarget).toBe(2200);
    expect(view.plan?.proteinTarget).toBe(150);
  });

  it("updates the calorie and protein targets without touching anything else", async () => {
    await call("update_diet_plan", alice, { proteinTarget: 160 });
    const view = await read(alice);
    expect(view.plan?.proteinTarget).toBe(160);
    expect(view.plan?.calorieTarget).toBe(2200);
    expect(view.plan?.name).toBe("Lean Muscle Gain");
  });

  it("adds meals in order and keeps their targets", async () => {
    await call("add_diet_meal", alice, {
      name: "Breakfast",
      mealType: "breakfast",
      recommendedTime: "10:30-11:00",
      calorieTarget: 650,
      proteinTarget: 33,
    });
    await call("add_diet_meal", alice, { name: "Lunch", mealType: "lunch", calorieTarget: 550 });
    await call("add_diet_meal", alice, { name: "Dinner", mealType: "dinner", calorieTarget: 650 });

    const view = await read(alice);
    expect(view.meals.map((meal) => meal.name)).toEqual(["Breakfast", "Lunch", "Dinner"]);
    expect(view.meals[0].calorieTarget).toBe(650);
    expect(view.meals[0].proteinTarget).toBe(33);
  });

  it("adds meal options by meal name, with ingredients and a default", async () => {
    const added = await call("add_diet_meal_option", alice, {
      meal: "dinner",
      name: "Egg bhurji",
      ingredients: ["4 eggs", "3-4 roti"],
      calories: 700,
      proteinG: 34,
      isDefault: true,
    });
    expect(added.summary).toBe("Added \"Egg bhurji\" to Dinner as the default.");
    await call("add_diet_meal_option", alice, {
      meal: "Dinner",
      name: "Paneer bhurji",
      ingredients: ["120-150g paneer", "roti"],
    });

    const dinner = (await read(alice)).meals.find((meal) => meal.name === "Dinner");
    expect(dinner?.options.map((option) => option.name)).toEqual(["Egg bhurji", "Paneer bhurji"]);
    expect(dinner?.options[0].isDefault).toBe(true);
    expect(dinner?.options[0].ingredients).toEqual(["4 eggs", "3-4 roti"]);
  });

  it("updates an option found by name", async () => {
    await call("update_diet_meal_option", alice, {
      option: "paneer",
      calories: 660,
      ingredients: ["150g paneer", "3 roti"],
    });
    const dinner = (await read(alice)).meals.find((meal) => meal.name === "Dinner");
    const paneer = dinner?.options.find((option) => option.name === "Paneer bhurji");
    expect(paneer?.ingredients).toEqual(["150g paneer", "3 roti"]);
  });

  it("removes an option by disabling it, and can restore it", async () => {
    const removed = await call("remove_diet_meal_option", alice, { option: "Paneer bhurji" });
    expect(removed.summary).toContain("Removed");

    const dinner = (await read(alice)).meals.find((meal) => meal.name === "Dinner");
    expect(dinner?.options.map((option) => option.name)).toEqual(["Egg bhurji"]);

    const withInactive = await read(alice, { includeInactive: true });
    const all = withInactive.meals.find((meal) => meal.name === "Dinner");
    expect(all?.options.find((option) => option.name === "Paneer bhurji")?.active).toBe(false);

    await call("remove_diet_meal_option", alice, { option: "Paneer bhurji", restore: true });
    const restored = (await read(alice)).meals.find((meal) => meal.name === "Dinner");
    expect(restored?.options).toHaveLength(2);
  });

  it("reorders meals by name and leaves unlisted meals after them", async () => {
    const reordered = await call("reorder_diet_meals", alice, { meals: ["Dinner", "Breakfast"] });
    expect(reordered.summary).toContain("Dinner → Breakfast");
    expect((await read(alice)).meals.map((meal) => meal.name)).toEqual([
      "Dinner",
      "Breakfast",
      "Lunch",
    ]);

    await call("reorder_diet_meals", alice, { meals: ["Breakfast", "Lunch", "Dinner"] });
    expect((await read(alice)).meals.map((meal) => meal.name)).toEqual([
      "Breakfast",
      "Lunch",
      "Dinner",
    ]);
  });

  it("drops a meal with update_diet_meal and keeps it out of the plan", async () => {
    await call("add_diet_meal", alice, { name: "Second lunch" });
    await call("update_diet_meal", alice, { meal: "Second lunch", active: false });
    const view = await read(alice);
    expect(view.meals.map((meal) => meal.name)).not.toContain("Second lunch");
    const all = await read(alice, { includeInactive: true });
    expect(all.meals.map((meal) => meal.name)).toContain("Second lunch");
  });

  it("never writes a food log when the plan changes", async () => {
    const before = await db.select().from(foodLogs).where(eq(foodLogs.userId, alice.userId));

    await call("update_diet_plan", alice, { calorieTarget: 2300 });
    await call("add_diet_meal", alice, { name: "Pre-workout" });
    await call("add_diet_meal_option", alice, {
      meal: "Pre-workout",
      name: "Bread and eggs",
      calories: 280,
      proteinG: 16,
    });
    await call("update_diet_meal_option", alice, { option: "Bread and eggs", calories: 300 });
    await call("remove_diet_meal_option", alice, { option: "Bread and eggs" });

    const after = await db.select().from(foodLogs).where(eq(foodLogs.userId, alice.userId));
    expect(after).toHaveLength(before.length);
    await call("update_diet_plan", alice, { calorieTarget: 2200 });
  });

  it("never changes the plan when food is logged", async () => {
    const before = await read(alice);
    await logFood(alice.userId, "UTC", {
      name: "Egg bhurji",
      calories: 700,
      proteinG: 34,
      carbsG: null,
      fatG: null,
      quantity: 1,
      unit: "serving",
      mealType: "dinner",
      notes: null,
      occurredAt: null,
      foodId: null,
      estimated: false,
    });
    const logged = await db.select().from(foodLogs).where(eq(foodLogs.userId, alice.userId));
    expect(logged.length).toBeGreaterThan(0);

    const after = await read(alice);
    expect(after).toEqual(before);
  });

  it("reports the nutrition goals alongside the plan instead of duplicating them", async () => {
    const view = await read(alice);
    // No goals were created by any diet tool.
    expect(view.nutritionGoals).toEqual({ calories: null, proteinG: null });
  });

  it("keeps one user's plan out of another's reach", async () => {
    await call("add_diet_plan", bob, { name: "Bob's plan" });
    await call("add_diet_meal", bob, { name: "Breakfast" });

    expect((await read(bob)).meals.map((meal) => meal.name)).toEqual(["Breakfast"]);
    expect((await read(alice)).plan?.name).toBe("Lean Muscle Gain");

    const aliceDinner = (await read(alice)).meals.find((meal) => meal.name === "Dinner");
    // Bob asking for Alice's meal id gets nothing back, not her data.
    await expect(
      call("update_diet_meal", bob, { mealId: aliceDinner?.id, name: "Hijacked" }),
    ).rejects.toBeInstanceOf(ToolFailure);
    expect((await read(alice)).meals.find((meal) => meal.id === aliceDinner?.id)?.name).toBe("Dinner");
  });

  it("switches the active plan, leaving only one active", async () => {
    const second = await call("add_diet_plan", alice, { name: "Cutting" });
    const secondId = (second.data as { id: string }).id;
    expect((await read(alice)).plan?.name).toBe("Cutting");

    const plans = await db
      .select()
      .from(dietPlans)
      .where(and(eq(dietPlans.userId, alice.userId), eq(dietPlans.active, true)));
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe(secondId);

    const first = (await db.select().from(dietPlans).where(eq(dietPlans.userId, alice.userId))).find(
      (plan) => plan.name === "Lean Muscle Gain",
    );
    await call("update_diet_plan", alice, { planId: first?.id, active: true });
    expect((await read(alice)).plan?.name).toBe("Lean Muscle Gain");
  });
});

suite("logging a planned option", () => {
  let user: McpContext;

  beforeAll(async () => {
    user = await createUser("diet-log");
    await call("add_diet_plan", user, { name: "Plan", calorieTarget: 2200 });
    await call("add_diet_meal", user, { name: "Dinner", mealType: "dinner" });
    await call("add_diet_meal_option", user, {
      meal: "Dinner",
      name: "Egg bhurji",
      description: "4 eggs, 3-4 roti",
      calories: 700,
      proteinG: 34,
      isDefault: true,
    });
  });

  afterAll(async () => {
    if (user) await db.delete(users).where(eq(users.id, user.userId));
  });

  it("writes one food log, marked as an estimate, and leaves the plan alone", async () => {
    const before = await read(user);
    const option = before.meals[0].options[0];

    const logged = await logDietMealOption(user.userId, "UTC", option.id);
    expect(logged?.name).toBe("Egg bhurji");
    expect(logged?.calories).toBe(700);
    expect(logged?.proteinG).toBe(34);
    // The meal's type decides the food-log bucket.
    expect(logged?.mealType).toBe("dinner");
    // Planned macros are estimates, and say so.
    expect(logged?.estimated).toBe(true);

    const rows = await db.select().from(foodLogs).where(eq(foodLogs.userId, user.userId));
    expect(rows).toHaveLength(1);
    expect(await read(user)).toEqual(before);
  });

  it("refuses an option belonging to someone else", async () => {
    const other = await createUser("diet-log-other");
    try {
      const option = (await read(user)).meals[0].options[0];
      expect(await logDietMealOption(other.userId, "UTC", option.id)).toBeNull();
      const rows = await db.select().from(foodLogs).where(eq(foodLogs.userId, other.userId));
      expect(rows).toHaveLength(0);
    } finally {
      await db.delete(users).where(eq(users.id, other.userId));
    }
  });
});
