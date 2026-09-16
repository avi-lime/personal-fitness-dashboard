import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { McpAuthError, resolveContext, type McpContext } from "@/mcp/context";
import { verifyMcpToken } from "@/mcp/auth";
import {
  getFoodLog,
  getGoalWithProgress,
  getGoals,
  getToday,
  getWeeklySummaryTool,
  getWeightHistory,
  getWorkout,
} from "@/mcp/tools/read";
import {
  ToolFailure,
  addGoalTool,
  addNoteTool,
  completeGoalTool,
  logFoodTool,
  logSleepTool,
  logWaterTool,
  logWeightTool,
  logWorkoutTool,
  removeGoalTool,
  updateGoalTool,
} from "@/mcp/tools/write";
import { toLocalDate } from "@/lib/date";

/**
 * These exercise the real tool bodies against a real database. Two users are
 * created so the isolation assertions are meaningful.
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

async function createUser(label: string): Promise<McpContext> {
  const username = `vitest-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db.insert(users).values({ username }).returning();
  await db.insert(profiles).values({ userId: user.id, timezone: "UTC" });
  return { userId: user.id, timezone: "UTC", today: toLocalDate(new Date(), "UTC"), source: "mcp" };
}

suite("MCP tools", () => {
  let alice: McpContext;
  let bob: McpContext;

  beforeAll(async () => {
    alice = await createUser("alice");
    bob = await createUser("bob");
  });

  afterAll(async () => {
    if (alice) await db.delete(users).where(eq(users.id, alice.userId));
    if (bob) await db.delete(users).where(eq(users.id, bob.userId));
  });

  describe("authentication boundary", () => {
    it("refuses a request with no auth info", async () => {
      await expect(resolveContext(undefined)).rejects.toBeInstanceOf(McpAuthError);
    });

    it("refuses auth info without a resolved user", async () => {
      await expect(
        resolveContext({ token: "t", clientId: "c", scopes: [], extra: {} }),
      ).rejects.toBeInstanceOf(McpAuthError);
    });

    it("rejects a wrong or missing bearer token", async () => {
      await expect(verifyMcpToken(new Request("http://x"), undefined)).resolves.toBeUndefined();
      await expect(verifyMcpToken(new Request("http://x"), "wrong")).resolves.toBeUndefined();
    });

    it("accepts the configured token and resolves the owner", async () => {
      const info = await verifyMcpToken(new Request("http://x"), process.env.MCP_TOKEN as string);
      expect(info?.clientId).toBe("life-dashboard-mcp");
      expect(typeof info?.extra?.userId).toBe("string");
    });
  });

  describe("write tools", () => {
    it("logs food and reflects it in the day's totals", async () => {
      await logFoodTool(alice, { foodName: "Oats", calories: 420, protein: 18 });
      await logFoodTool(alice, { foodName: "Shake", calories: 260, protein: 30 });

      const log = await getFoodLog(alice, {});
      expect(log.entries).toHaveLength(2);
      expect(log.totals.calories).toBe(680);
      expect(log.totals.proteinG).toBe(48);
      // Macros that were not supplied stay null rather than being invented.
      expect(log.entries[0].carbsG).toBeNull();
    });

    it("logs water, weight and sleep", async () => {
      await logWaterTool(alice, { milliliters: 500 });
      await logWaterTool(alice, { milliliters: 250 });
      await logWeightTool(alice, { kilograms: 50.4, note: "morning" });
      const start = new Date(Date.now() - 8 * 3_600_000).toISOString();
      const sleep = await logSleepTool(alice, { startTime: start, endTime: new Date().toISOString() });
      expect(sleep.data.hours).toBeCloseTo(8, 1);

      const today = await getToday(alice);
      expect(today.totals.waterMl).toBe(750);
      expect(today.totals.weightKg).toBe(50.4);
      expect(today.totals.sleepHours).toBeCloseTo(8, 1);
    });

    it("creates a workout and marks it complete by default", async () => {
      const created = await logWorkoutTool(alice, { workoutName: "Push day" });
      expect(created.data.completed).toBe(true);

      const workouts = await getWorkout(alice, {});
      expect(workouts.workouts).toHaveLength(1);
      expect(workouts.workouts[0].name).toBe("Push day");
      expect(workouts.workouts[0].completed).toBe(true);
    });

    it("creates, updates and archives goals", async () => {
      const created = await addGoalTool(alice, {
        name: "Reading",
        type: "duration",
        unit: "h",
        targetValue: 0.5,
        period: "daily",
      });
      const goalId = created.data.id;

      const updated = await updateGoalTool(alice, { goalId, targetValue: 1, active: false });
      expect(updated.data.targetValue).toBe(1);
      expect(updated.data.active).toBe(false);

      const listed = await getGoals(alice);
      expect(listed.goals.some((goal) => goal.id === goalId)).toBe(true);

      await removeGoalTool(alice, { goalId });
      const afterRemoval = await getGoals(alice);
      expect(afterRemoval.goals.some((goal) => goal.id === goalId)).toBe(false);
    });

    it("records progress for manual goals only", async () => {
      const manual = await addGoalTool(alice, {
        name: "Creatine",
        type: "boolean",
        period: "daily",
      });
      const done = await completeGoalTool(alice, { goalId: manual.data.id });
      expect(done.data.value).toBe(1);

      const progress = await getGoalWithProgress(alice, { goalId: manual.data.id });
      expect(progress?.progress.status).toBe("complete");

      const metricGoal = await addGoalTool(alice, {
        name: "Protein",
        type: "numeric",
        unit: "g",
        targetValue: 100,
        period: "daily",
        metricKey: "protein",
      });
      await expect(
        completeGoalTool(alice, { goalId: metricGoal.data.id }),
      ).rejects.toBeInstanceOf(ToolFailure);

      // The metric-backed goal still tracks the food logged earlier.
      const proteinProgress = await getGoalWithProgress(alice, { goalId: metricGoal.data.id });
      expect(proteinProgress?.progress.current).toBe(48);
    });

    it("adds notes", async () => {
      const note = await addNoteTool(alice, { note: "felt strong" });
      expect(note.data.body).toBe("felt strong");
      expect(note.data.date).toBe(alice.today);
    });
  });

  describe("read tools", () => {
    it("summarises the day with a next action", async () => {
      const today = await getToday(alice);
      expect(today.date).toBe(alice.today);
      expect(today.nextAction.label.length).toBeGreaterThan(0);
      expect(today.goals.length).toBeGreaterThan(0);
    });

    it("returns weight history with statistics", async () => {
      const history = await getWeightHistory(alice, {
        startDate: alice.today,
        endDate: alice.today,
      });
      expect(history.entries).toHaveLength(1);
      expect(history.stats.latest).toBe(50.4);
    });

    it("summarises the week", async () => {
      const summary = await getWeeklySummaryTool(alice, {});
      expect(summary.weekStart <= alice.today).toBe(true);
      expect(summary.averages.calories).toBeGreaterThan(0);
      expect(summary.workouts).toBe(1);
    });
  });

  describe("user isolation", () => {
    it("never returns another user's entries", async () => {
      const bobLog = await getFoodLog(bob, {});
      expect(bobLog.entries).toHaveLength(0);

      const bobToday = await getToday(bob);
      expect(bobToday.totals.calories).toBe(0);
      expect(bobToday.goals).toHaveLength(0);

      const bobWorkouts = await getWorkout(bob, {});
      expect(bobWorkouts.workouts).toHaveLength(0);
    });

    it("cannot read or mutate another user's goal", async () => {
      const aliceGoals = await getGoals(alice);
      const target = aliceGoals.goals[0];
      expect(target).toBeDefined();

      expect(await getGoalWithProgress(bob, { goalId: target.id })).toBeNull();
      await expect(updateGoalTool(bob, { goalId: target.id, name: "hijacked" })).rejects.toBeInstanceOf(
        ToolFailure,
      );
      await expect(removeGoalTool(bob, { goalId: target.id })).rejects.toBeInstanceOf(ToolFailure);
      await expect(completeGoalTool(bob, { goalId: target.id })).rejects.toBeInstanceOf(ToolFailure);

      // Alice's goal is untouched.
      const stillThere = await getGoalWithProgress(alice, { goalId: target.id });
      expect(stillThere?.goal.name).toBe(target.name);
    });
  });
});
