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

  // --- Tasks, time, routines, career, money ---------------------------------
  // Whole-life sample data; every row is tagged "seed" like the rest.
  for (const table of [schema.tasks, schema.timeEntries, schema.timeBlocks, schema.applications, schema.transactions, schema.bills]) {
    await db.delete(table).where(eq(table.source, "seed"));
  }

  await db.insert(schema.tasks).values([
    { userId: user.id, title: "Update resume", area: "career" as const, dueDate: addDays(today, -1), priority: "high" as const, source: "seed" as const },
    { userId: user.id, title: "Send invoice to client", area: "freelance" as const, dueDate: today, priority: "medium" as const, source: "seed" as const },
    { userId: user.id, title: "Read system design chapter 4", area: "study" as const, dueDate: addDays(today, 3), priority: "low" as const, source: "seed" as const },
  ]);

  await db.insert(schema.timeEntries).values(
    [
      { category: "study" as const, label: "DSA practice", minutes: 45, offsetHours: 6 },
      { category: "freelance" as const, label: "Client dashboard", minutes: 120, offsetHours: 3 },
    ].map((entry) => {
      const endAt = new Date(now.getTime() - entry.offsetHours * 3_600_000);
      return {
        userId: user.id,
        category: entry.category,
        label: entry.label,
        startAt: new Date(endAt.getTime() - entry.minutes * 60_000),
        endAt,
        durationMinutes: entry.minutes,
        localDate: today,
        source: "seed" as const,
      };
    }),
  );

  const existingRoutines = await db.query.routines.findMany({ where: eq(schema.routines.userId, user.id) });
  if (existingRoutines.length === 0) {
    await db.insert(schema.routines).values([
      { userId: user.id, label: "Gym", kind: "workout" as const, area: "fitness" as const, startTime: "07:00", endTime: "08:00", weekdays: 1 | 4 | 16 },
      { userId: user.id, label: "Deep work", kind: "routine" as const, area: "work" as const, startTime: "10:00", endTime: "12:00", weekdays: 31 },
      { userId: user.id, label: "Study", kind: "study" as const, area: "study" as const, startTime: "20:00", endTime: "21:00", weekdays: 127 },
    ]);
  }

  await db.insert(schema.applications).values([
    { userId: user.id, company: "Acme", role: "Senior Engineer", stage: "interview" as const, nextStep: "System design round", nextStepDate: addDays(today, 2), appliedOn: addDays(today, -10), source: "seed" as const },
    { userId: user.id, company: "Globex", role: "Staff Engineer", stage: "applied" as const, appliedOn: addDays(today, -3), source: "seed" as const },
    { userId: user.id, company: "Initech", role: "Tech Lead", stage: "wishlist" as const, source: "seed" as const },
  ]);

  const [bank] = await db
    .insert(schema.moneyAccounts)
    .values({ userId: user.id, name: "Salary account", kind: "bank" as const, balance: 42000 })
    .onConflictDoUpdate({ target: [schema.moneyAccounts.userId, schema.moneyAccounts.name], set: { balance: 42000 } })
    .returning();
  await db
    .insert(schema.moneyAccounts)
    .values({ userId: user.id, name: "Credit card", kind: "credit_card" as const, balance: 3200, creditLimit: 100000, dueDay: 15 })
    .onConflictDoUpdate({ target: [schema.moneyAccounts.userId, schema.moneyAccounts.name], set: { balance: 3200 } });

  await db.insert(schema.transactions).values([
    { userId: user.id, accountId: bank.id, amount: 250, kind: "expense" as const, category: "food" as const, label: "Lunch", occurredAt: new Date(now.getTime() - 4 * 3_600_000), localDate: today, source: "seed" as const },
    { userId: user.id, accountId: bank.id, amount: 80, kind: "expense" as const, category: "transport" as const, label: "Auto", occurredAt: new Date(now.getTime() - 9 * 3_600_000), localDate: today, source: "seed" as const },
    { userId: user.id, accountId: bank.id, amount: 1499, kind: "expense" as const, category: "subscriptions" as const, label: "Course", occurredAt: new Date(`${addDays(today, -2)}T10:00:00Z`), localDate: addDays(today, -2), source: "seed" as const },
  ]);

  await db.insert(schema.bills).values([
    { userId: user.id, name: "Electricity", amount: 1800, dueDate: addDays(today, 4), recurrence: "monthly" as const, accountId: bank.id, source: "seed" as const },
    { userId: user.id, name: "Rent", amount: 18000, dueDate: addDays(today, 12), recurrence: "monthly" as const, accountId: bank.id, category: "rent" as const, source: "seed" as const },
  ]);

  await sql.end();
  console.log(`Seeded development data for "${username}" (timezone ${timezone}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
