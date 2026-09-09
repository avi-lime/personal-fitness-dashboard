/**
 * DEVELOPMENT-ONLY seed data.
 *
 * Creates a small, realistic profile so the dashboard has something to render
 * while developing. Every row it writes is tagged `source: "seed"` and the UI
 * marks those entries as sample data.
 *
 * It refuses to run against NODE_ENV=production unless ALLOW_PRODUCTION_SEED=1
 * is set explicitly.
 *
 * Usage: npm run db:seed
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { addDays, toLocalDate } from "../src/lib/date";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "1") {
    throw new Error(
      "Refusing to seed a production database. Set ALLOW_PRODUCTION_SEED=1 only if you really mean it.",
    );
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const username = process.env.AUTH_USERNAME ?? "owner";
  const timezone = process.env.SEED_TIMEZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.username, username),
  });
  const user =
    existing ??
    (await db.insert(schema.users).values({ username }).returning())[0];

  await db
    .insert(schema.profiles)
    .values({
      userId: user.id,
      displayName: "You",
      heightCm: 170,
      startingWeightKg: 50,
      targetWeightKg: 56,
      timezone,
    })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: { heightCm: 170, startingWeightKg: 50, targetWeightKg: 56, timezone },
    });

  // Wipe previously seeded rows so the script is repeatable.
  for (const table of [
    schema.goalEntries,
    schema.foodLogs,
    schema.waterLogs,
    schema.weightEntries,
    schema.sleepEntries,
    schema.notes,
  ]) {
    await db.delete(table).where(eq(table.source, "seed"));
  }
  await db.delete(schema.workouts).where(eq(schema.workouts.source, "seed"));

  const today = toLocalDate(new Date(), timezone);

  // --- Goals ---------------------------------------------------------------
  // Starting points only: every one of these is editable or removable in the UI.
  const goalSeeds = [
    { name: "Calories", type: "numeric" as const, unit: "kcal", targetValue: 2300, metricKey: "calories" as const },
    { name: "Protein", type: "numeric" as const, unit: "g", targetValue: 100, metricKey: "protein" as const },
    { name: "Water", type: "numeric" as const, unit: "L", targetValue: 2.5, metricKey: "water_ml" as const },
    { name: "Sleep", type: "duration" as const, unit: "h", targetValue: 7.5, metricKey: "sleep_hours" as const },
    { name: "Workout", type: "count" as const, unit: "sessions", targetValue: 1, metricKey: "workouts" as const },
    {
      name: "Weight",
      type: "numeric" as const,
      unit: "kg",
      targetValue: null,
      metricKey: "body_weight_kg" as const,
      showInChecklist: false,
    },
  ];

  const existingGoals = await db.query.goals.findMany({ where: eq(schema.goals.userId, user.id) });
  if (existingGoals.length === 0) {
    await db.insert(schema.goals).values(
      goalSeeds.map((goal, index) => ({
        userId: user.id,
        name: goal.name,
        type: goal.type,
        unit: goal.unit,
        targetValue: goal.targetValue,
        period: "daily" as const,
        metricKey: goal.metricKey,
        sortOrder: index,
        showInChecklist: goal.showInChecklist ?? true,
      })),
    );
  }

  // --- Food ----------------------------------------------------------------
  await db.insert(schema.foods).values([
    {
      userId: user.id,
      name: "Breakfast oats",
      calories: 420,
      proteinG: 18,
      carbsG: 62,
      fatG: 10,
      servingQuantity: 1,
      servingUnit: "bowl",
    },
    {
      userId: user.id,
      name: "Post-workout shake",
      calories: 260,
      proteinG: 30,
      carbsG: 22,
      fatG: 4,
      servingQuantity: 1,
      servingUnit: "shake",
    },
  ]).onConflictDoNothing();

  const now = new Date();
  await db.insert(schema.foodLogs).values([
    {
      userId: user.id,
      name: "Breakfast oats",
      calories: 420,
      proteinG: 18,
      carbsG: 62,
      fatG: 10,
      quantity: 1,
      unit: "bowl",
      mealType: "breakfast" as const,
      occurredAt: new Date(now.getTime() - 5 * 3_600_000),
      localDate: today,
      source: "seed" as const,
    },
    {
      userId: user.id,
      name: "Post-workout shake",
      calories: 260,
      proteinG: 30,
      carbsG: 22,
      fatG: 4,
      quantity: 1,
      unit: "shake",
      mealType: "snack" as const,
      occurredAt: new Date(now.getTime() - 2 * 3_600_000),
      localDate: today,
      source: "seed" as const,
    },
  ]);

  // --- Water, weight, sleep ------------------------------------------------
  await db.insert(schema.waterLogs).values(
    [500, 500, 250].map((milliliters, index) => ({
      userId: user.id,
      milliliters,
      occurredAt: new Date(now.getTime() - (index + 1) * 3_600_000),
      localDate: today,
      source: "seed" as const,
    })),
  );

  await db.insert(schema.weightEntries).values(
    [50.2, 50.4, 50.3, 50.6, 50.8].map((weightKg, index) => {
      const date = addDays(today, index - 4);
      return {
        userId: user.id,
        weightKg,
        occurredAt: new Date(`${date}T07:00:00Z`),
        localDate: date,
        source: "seed" as const,
      };
    }),
  );

  await db.insert(schema.sleepEntries).values(
    [0, 1, 2].map((offset) => {
      const wake = addDays(today, -offset);
      return {
        userId: user.id,
        startAt: new Date(`${addDays(wake, -1)}T23:15:00Z`),
        endAt: new Date(`${wake}T06:45:00Z`),
        localDate: wake,
        quality: 4,
        source: "seed" as const,
      };
    }),
  );

  // --- Workout -------------------------------------------------------------
  const [workout] = await db
    .insert(schema.workouts)
    .values({
      userId: user.id,
      name: "Push day",
      localDate: today,
      notes: "Sample workout created by the development seed.",
      completedAt: new Date(),
      source: "seed" as const,
    })
    .returning();

  for (const [index, exercise] of [
    { name: "Bench press", muscleGroup: "Chest", sets: [{ reps: 8, weightKg: 30 }, { reps: 8, weightKg: 32.5 }, { reps: 6, weightKg: 35 }] },
    { name: "Overhead press", muscleGroup: "Shoulders", sets: [{ reps: 10, weightKg: 20 }, { reps: 9, weightKg: 20 }] },
  ].entries()) {
    const [inserted] = await db
      .insert(schema.workoutExercises)
      .values({
        workoutId: workout.id,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        sortOrder: index,
      })
      .returning();
    await db.insert(schema.workoutSets).values(
      exercise.sets.map((set, setIndex) => ({
        exerciseId: inserted.id,
        sortOrder: setIndex,
        reps: set.reps,
        weightKg: set.weightKg,
        completed: true,
      })),
    );
  }

  await db.insert(schema.notes).values({
    userId: user.id,
    localDate: today,
    body: "Sample note from the development seed.",
    source: "seed" as const,
  });

  await sql.end();
  console.log(`Seeded development data for "${username}" (timezone ${timezone}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
