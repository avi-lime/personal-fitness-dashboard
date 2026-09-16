import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { densify, loadDayFacts } from "@/server/services/day";
import { logFood } from "@/server/services/food";
import { logWater } from "@/server/services/water";
import { logSleep, logWeight } from "@/server/services/body";
import { createWorkout, setWorkoutCompletion } from "@/server/services/workouts";
import { eachDay } from "@/lib/date";

/** Daily aggregation is derived from events; these check the derivation itself. */

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

suite("daily aggregation", () => {
  const timezone = "Asia/Kolkata";
  let userId: string;

  beforeAll(async () => {
    const username = `vitest-facts-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [user] = await db.insert(users).values({ username }).returning();
    userId = user.id;
    await db.insert(profiles).values({ userId, timezone });
  });

  afterAll(async () => {
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("buckets events into the user's calendar day, not UTC", async () => {
    // 19:00 UTC on the 8th is 00:30 on the 9th in Asia/Kolkata (+05:30).
    await logFood(userId, timezone, {
      name: "Late snack",
      calories: 300,
      proteinG: 20,
      quantity: 1,
      unit: "serving",
      mealType: "snack",
      occurredAt: "2026-09-08T19:00:00Z",
      estimated: false,
    });
    // 17:00 UTC on the 8th is still the 8th locally (22:30).
    await logFood(userId, timezone, {
      name: "Dinner",
      calories: 700,
      proteinG: 40,
      quantity: 1,
      unit: "serving",
      mealType: "dinner",
      occurredAt: "2026-09-08T17:00:00Z",
      estimated: false,
    });

    const facts = densify(
      await loadDayFacts(userId, "2026-09-08", "2026-09-09"),
      eachDay("2026-09-08", "2026-09-09"),
    );
    expect(facts.get("2026-09-08")?.calories).toBe(700);
    expect(facts.get("2026-09-09")?.calories).toBe(300);
    expect(facts.get("2026-09-09")?.protein).toBe(20);
  });

  it("sums water, counts completed workouts and takes the day's last weigh-in", async () => {
    await logWater(userId, timezone, 500, "2026-09-09T04:00:00Z");
    await logWater(userId, timezone, 250, "2026-09-09T06:00:00Z");
    await logWeight(userId, timezone, 50.2, "2026-09-09T02:00:00Z");
    await logWeight(userId, timezone, 50.6, "2026-09-09T03:00:00Z");

    const incomplete = await createWorkout(userId, timezone, {
      name: "Skipped",
      date: "2026-09-09",
    });
    const done = await createWorkout(userId, timezone, { name: "Push", date: "2026-09-09" });
    await setWorkoutCompletion(userId, done.id, true);

    const facts = await loadDayFacts(userId, "2026-09-09", "2026-09-09");
    const day = facts.get("2026-09-09");
    expect(day?.waterMl).toBe(750);
    expect(day?.weightKg).toBe(50.6);
    // Only completed sessions count towards the workout metric.
    expect(day?.workoutCount).toBe(1);
    expect(incomplete.completedAt).toBeNull();
  });

  it("attributes sleep to the day the user woke up", async () => {
    await logSleep(userId, timezone, {
      startTime: "2026-09-09T17:30:00Z", // 23:00 local on the 9th
      endTime: "2026-09-10T01:00:00Z", // 06:30 local on the 10th
    });

    const facts = await loadDayFacts(userId, "2026-09-09", "2026-09-10");
    expect(facts.get("2026-09-09")?.sleepHours ?? 0).toBe(0);
    expect(facts.get("2026-09-10")?.sleepHours).toBe(7.5);
  });

  it("fills empty days so callers get one entry per date", async () => {
    const dates = eachDay("2026-09-01", "2026-09-05");
    const dense = densify(await loadDayFacts(userId, "2026-09-01", "2026-09-05"), dates);
    expect([...dense.keys()]).toEqual(dates);
    expect(dense.get("2026-09-03")?.calories).toBe(0);
    expect(dense.get("2026-09-03")?.weightKg).toBeNull();
  });
});

suite("time and task buckets", () => {
  const timezone = "UTC";
  let userId: string;

  beforeAll(async () => {
    const username = `vitest-buckets-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [user] = await db.insert(users).values({ username }).returning();
    userId = user.id;
    await db.insert(profiles).values({ userId, timezone });
  });

  afterAll(async () => {
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("sums finished sessions by category and counts completed tasks on their day", async () => {
    const { logTimeEntry, startTimer } = await import("@/server/services/time");
    const { completeTask, createTask } = await import("@/server/services/tasks");

    await logTimeEntry(userId, timezone, { category: "study", minutes: 30, date: "2026-09-10" });
    await logTimeEntry(userId, timezone, { category: "study", minutes: 15, date: "2026-09-10" });
    await logTimeEntry(userId, timezone, { category: "freelance", minutes: 120, date: "2026-09-10" });
    // A running timer must not count until it stops.
    await startTimer(userId, timezone, "work");

    const task = await createTask(userId, { title: "Ship it", priority: "high" });
    await completeTask(userId, task.id, "2026-09-10");
    const open = await createTask(userId, { title: "Not yet", priority: "low" });
    expect(open.status).toBe("todo");

    const facts = await loadDayFacts(userId, "2026-09-10", "2026-09-10");
    const day = facts.get("2026-09-10");
    expect(day?.minutesByCategory).toEqual({ study: 45, freelance: 120 });
    expect(day?.tasksCompleted).toBe(1);
  });
});
