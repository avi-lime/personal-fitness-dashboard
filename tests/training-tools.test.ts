import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, rpgLedger, users, workoutExercises, workoutSets, workouts } from "@/db/schema";
import type { McpContext } from "@/mcp/context";
import { toolByName } from "@/mcp/registry";
import { ToolFailure } from "@/mcp/tools/write";
import { addDays, toLocalDate } from "@/lib/date";
import { completeSet, getTrainingSnapshot, startPlannedWorkout } from "@/server/services/training";
import { claimMission, createReward, goldBalance, redeemReward } from "@/server/services/rpg";

/**
 * Training and the game against a real database: the planner reading real
 * history, sets being logged, missions paying out exactly once, gold that
 * cannot be overspent, and one user's training invisible to another.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const today = () => toLocalDate(new Date(), "UTC");

async function createUser(label: string): Promise<McpContext> {
  const username = `vitest-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db.insert(users).values({ username }).returning();
  await db.insert(profiles).values({ userId: user.id, timezone: "UTC" });
  return { userId: user.id, timezone: "UTC", today: today(), source: "assistant" };
}

const call = (name: string, ctx: McpContext, args: Record<string, unknown> = {}) => {
  const tool = toolByName.get(name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.run(ctx, tool.input.parse(args));
};

/** A finished session in the past, the way older data looks: free-text names, no keys. */
async function pastSession(
  userId: string,
  daysAgo: number,
  exercises: Array<{ name: string; sets: Array<[number, number]> }>,
  programDay: "push" | "pull" | "legs" | null = null,
) {
  const date = addDays(today(), -daysAgo);
  const [workout] = await db
    .insert(workouts)
    .values({ userId, name: "Old session", localDate: date, programDay, completedAt: new Date(`${date}T12:00:00Z`), createdAt: new Date(`${date}T11:00:00Z`) })
    .returning();
  for (const [index, exercise] of exercises.entries()) {
    const [row] = await db.insert(workoutExercises).values({ workoutId: workout.id, name: exercise.name, sortOrder: index }).returning();
    await db.insert(workoutSets).values(
      exercise.sets.map(([weightKg, reps], position) => ({ exerciseId: row.id, sortOrder: position, weightKg, reps, completed: true })),
    );
  }
  return workout.id;
}

suite("training tools", () => {
  let alice: McpContext;
  let bob: McpContext;

  beforeAll(async () => {
    alice = await createUser("train-alice");
    bob = await createUser("train-bob");
  });

  afterAll(async () => {
    if (alice) await db.delete(users).where(eq(users.id, alice.userId));
    if (bob) await db.delete(users).where(eq(users.id, bob.userId));
  });

  it("reads old free-text history into the muscle map", async () => {
    await pastSession(alice.userId, 6, [{ name: "Squats", sets: [[60, 8], [60, 8], [60, 8]] }], "legs");
    const snapshot = await getTrainingSnapshot(alice.userId, "UTC");
    const quads = snapshot.muscles.find((muscle) => muscle.muscle === "quads")!;
    expect(quads.lastTrained).toBe(addDays(today(), -6));
    expect(quads.state).toBe("due");
    expect(quads.level.total).toBeGreaterThan(0);
    // Chest was never trained: it heads the attention list over quads.
    expect(snapshot.attention[0].state).toBe("neglected");
    expect(snapshot.rpg.xp.training).toBe(3 * 10 + 50);
  });

  it("plans the next day of the rotation from the last program session", async () => {
    const plan = await call("get_next_workout", alice);
    expect((plan.data as { day: string }).day).toBe("push");
    expect(plan.summary).toMatch(/after Legs/);
  });

  it("starts the planned session pre-filled, and resumes instead of duplicating", async () => {
    const started = await call("start_workout", alice);
    const data = started.data as { workoutId: string; resumed: boolean; exercises: Array<{ name: string; sets: unknown[] }> };
    expect(data.resumed).toBe(false);
    expect(data.exercises.length).toBeGreaterThan(3);
    expect(data.exercises[0].sets.length).toBeGreaterThan(1);

    const [row] = await db.select().from(workouts).where(eq(workouts.id, data.workoutId));
    expect(row.programDay).toBe("push");
    const keyed = await db.select().from(workoutExercises).where(eq(workoutExercises.workoutId, data.workoutId));
    expect(keyed.every((exercise) => exercise.exerciseKey !== null)).toBe(true);

    const again = await call("start_workout", alice);
    expect((again.data as { workoutId: string; resumed: boolean })).toMatchObject({ workoutId: data.workoutId, resumed: true });
  });

  it("logs sets into the open session and calls out a PR against history", async () => {
    await pastSession(alice.userId, 9, [{ name: "Bench press", sets: [[50, 8], [50, 8]] }]);

    const first = await call("log_set", alice, { exercise: "bench", weightKg: 50, reps: 8 });
    expect(first.summary).toMatch(/Bench press set 1/);
    expect((first.data as { pr: unknown }).pr).toBeNull();

    const second = await call("log_set", alice, { exercise: "Bench Press", weightKg: 55, reps: 8 });
    expect(second.summary).toMatch(/set 2/);
    expect(second.summary).toMatch(/New PR: 55 kg × 8/);
    expect((second.data as { xp: number }).xp).toBe(35);

    // An exercise outside the plan joins the session rather than failing.
    const extra = await call("log_set", alice, { exercise: "plank", seconds: 45 });
    expect(extra.summary).toMatch(/Plank set 1: 45s/);
  });

  it("pays a mission out once, and only when it is actually done", async () => {
    // Nothing finished today yet: the session mission is not claimable.
    await expect(call("claim_mission", alice, { mission: "daily-session" })).rejects.toBeInstanceOf(ToolFailure);

    const snapshot = await getTrainingSnapshot(alice.userId, "UTC");
    await db.update(workouts).set({ completedAt: new Date() }).where(eq(workouts.id, snapshot.active!.id));

    const claimed = await call("claim_mission", alice, { mission: "Train today" });
    expect(claimed.summary).toBe('Claimed "Train today": +40 XP, +10 gold.');
    const twice = await claimMission(alice.userId, "UTC", "daily-session");
    expect(twice).toMatchObject({ ok: false });

    const rows = await db.select().from(rpgLedger).where(eq(rpgLedger.userId, alice.userId));
    expect(rows).toHaveLength(1);
    expect(await goldBalance(alice.userId)).toBe(10);

    const after = await getTrainingSnapshot(alice.userId, "UTC");
    expect(after.rpg.xp.missions).toBe(40);
    expect(after.rpg.gold).toBe(10);
  });

  it("never lets gold go negative", async () => {
    const reward = await createReward(alice.userId, { name: "Cheat meal", cost: 25 });
    const refused = await redeemReward(alice.userId, reward.id);
    expect(refused).toMatchObject({ ok: false });
    expect(await goldBalance(alice.userId)).toBe(10);

    const cheap = await call("add_reward", alice, { name: "Extra rest day", cost: 10 });
    expect(cheap.summary).toMatch(/10 gold/);
    const bought = await call("redeem_reward", alice, { reward: "rest day" });
    expect(bought.summary).toMatch(/0 gold left/);
    await expect(call("redeem_reward", alice, { reward: "rest day" })).rejects.toBeInstanceOf(ToolFailure);
  });

  it("switches program and equipment, and the plan follows", async () => {
    await call("set_training_preferences", bob, { program: "push_pull", equipment: "bodyweight", daysPerWeek: 3 });
    const plan = (await call("get_next_workout", bob)).data as { exercises: Array<{ key: string }> };
    expect(plan.exercises.map((exercise) => exercise.key)).toContain("push-up");
    expect(plan.exercises.map((exercise) => exercise.key)).not.toContain("barbell-bench-press");
  });

  it("keeps each user's training to themselves", async () => {
    const aliceActive = (await getTrainingSnapshot(alice.userId, "UTC")).sessions[0];
    const [aliceSet] = await db
      .select({ id: workoutSets.id })
      .from(workoutSets)
      .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.exerciseId))
      .where(eq(workoutExercises.workoutId, aliceActive.workoutId))
      .limit(1);
    expect(await completeSet(bob.userId, aliceSet.id, { reps: 99 })).toBeNull();

    const bobView = await getTrainingSnapshot(bob.userId, "UTC");
    expect(bobView.rpg.xp.training).toBe(0);
    expect(bobView.sessions).toHaveLength(0);
    const resumed = await startPlannedWorkout(bob.userId, "UTC");
    expect(resumed.resumed).toBe(false);
  });
});

suite("warm-ups", () => {
  let carol: McpContext;
  beforeAll(async () => {
    carol = await createUser("warm-carol");
  });
  afterAll(async () => {
    if (carol) await db.delete(users).where(eq(users.id, carol.userId));
  });

  it("logs a warm-up that earns nothing and never becomes a record", async () => {
    await pastSession(carol.userId, 5, [{ name: "Bench press", sets: [[40, 8]] }]);
    const warm = await call("log_set", carol, { exercise: "bench", weightKg: 60, reps: 8, warmup: true });
    expect((warm.data as { xp: number; pr: unknown }).xp).toBe(0);
    expect((warm.data as { pr: unknown }).pr).toBeNull();
    expect(warm.summary).toMatch(/warm-up/);

    const snapshot = await getTrainingSnapshot(carol.userId, "UTC");
    // Only the past work set counts: one set, one finished session.
    expect(snapshot.rpg.xp.training).toBe(10 + 50);
    expect(snapshot.prs).toHaveLength(0);
  });

  it("opens a planned session with its warm-up rows first", async () => {
    await pastSession(carol.userId, 8, [{ name: "Bench press", sets: [[60, 8], [60, 8]] }], "legs");
    const active = (await getTrainingSnapshot(carol.userId, "UTC")).active;
    if (active) await db.update(workouts).set({ completedAt: new Date() }).where(eq(workouts.id, active.id));
    const { workout } = await startPlannedWorkout(carol.userId, "UTC");
    const bench = workout.exercises.find((exercise) => exercise.exerciseKey === "barbell-bench-press")!;
    const phases = bench.sets.map((set) => set.phase);
    expect(phases[0]).toBe("warmup");
    expect(phases.indexOf("work")).toBeGreaterThan(0);
    expect(phases.slice(phases.indexOf("work")).every((phase) => phase === "work")).toBe(true);
  });
});

suite("linking supersets", () => {
  let dan: McpContext;
  beforeAll(async () => {
    dan = await createUser("superset-dan");
  });
  afterAll(async () => {
    if (dan) await db.delete(users).where(eq(users.id, dan.userId));
  });

  it("links neighbours, splits them, and drops a group of one", async () => {
    const { setSuperset, getWorkout } = await import("@/server/services/workouts");
    const id = await pastSession(dan.userId, 1, [
      { name: "Bench press", sets: [[60, 8]] },
      { name: "Barbell row", sets: [[50, 8]] },
      { name: "Lateral raise", sets: [[8, 15]] },
    ]);
    const groups = async () => (await getWorkout(dan.userId, id))!.exercises.map((exercise) => exercise.supersetGroup);
    const exercises = (await getWorkout(dan.userId, id))!.exercises;

    expect(await setSuperset(dan.userId, exercises[0].id, true)).toBe(true);
    const [a, b, c] = await groups();
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    expect(c).toBeNull();

    await setSuperset(dan.userId, exercises[1].id, true);
    expect(new Set(await groups()).size).toBe(1);

    // Split after the first: it is left alone, so it stops being a superset.
    await setSuperset(dan.userId, exercises[0].id, false);
    const [first, second, third] = await groups();
    expect(first).toBeNull();
    expect(second).not.toBeNull();
    expect(third).toBe(second);

    // The last exercise has nothing after it to link to; another user cannot link at all.
    expect(await setSuperset(dan.userId, exercises[2].id, true)).toBe(false);
    expect(await setSuperset(alienId, exercises[0].id, true)).toBe(false);
  });
});
const alienId = "00000000-0000-4000-8000-000000000000";
