import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import type { McpContext } from "@/mcp/context";
import { toolByName } from "@/mcp/registry";
import { ToolFailure } from "@/mcp/tools/write";
import { toLocalDate } from "@/lib/date";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

async function createUser(label: string): Promise<McpContext> {
  const username = `vitest-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db.insert(users).values({ username }).returning();
  await db.insert(profiles).values({ userId: user.id, timezone: "UTC" });
  return { userId: user.id, timezone: "UTC", today: toLocalDate(new Date(), "UTC"), source: "assistant" };
}

const call = (name: string, ctx: McpContext, args: Record<string, unknown>) => {
  const tool = toolByName.get(name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.run(ctx, tool.input.parse(args));
};

suite("task and time tools", () => {
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

  it("adds, lists, completes and updates tasks by loose title", async () => {
    await call("add_task", alice, { title: "Update resume", area: "career", dueDate: "2026-09-20" });
    await call("add_task", alice, { title: "Renew passport", priority: "high" });

    const listed = await call("list_tasks", alice, {});
    expect(listed.summary).toBe("2 open task(s).");

    const done = await call("complete_task", alice, { title: "resume" });
    expect(done.summary).toBe('Completed "Update resume".');

    const updated = await call("update_task", alice, { match: "passport", dueDate: "2026-10-01" });
    expect(updated.summary).toBe('Updated dueDate on "Renew passport".');

    const open = await call("list_tasks", alice, {});
    expect((open.data as { tasks: unknown[] }).tasks).toHaveLength(1);
  });

  it("refuses an ambiguous or unknown title with a clear message", async () => {
    await call("add_task", alice, { title: "Email Alice" });
    await call("add_task", alice, { title: "Email Bob" });
    await expect(call("complete_task", alice, { title: "email" })).rejects.toThrow(/Ambiguous/);
    await expect(call("complete_task", alice, { title: "zzz" })).rejects.toBeInstanceOf(ToolFailure);
  });

  it("runs one timer at a time and logs finished sessions", async () => {
    const first = await call("start_timer", alice, { category: "study", label: "DSA" });
    expect(first.summary).toMatch(/^Started a study timer \(DSA\)\.$/);

    const second = await call("start_timer", alice, { category: "freelance" });
    expect(second.summary).toMatch(/Stopped the study timer/);

    const stopped = await call("stop_timer", alice, {});
    expect(stopped.summary).toMatch(/Stopped the freelance timer/);
    await expect(call("stop_timer", alice, {})).rejects.toThrow("No timer is running.");

    const logged = await call("log_time", alice, { category: "work", minutes: 90 });
    expect(logged.summary).toMatch(/^Logged 1h 30m of work on /);
  });

  it("keeps users apart", async () => {
    const bobs = await call("list_tasks", bob, { status: "all" });
    expect((bobs.data as { tasks: unknown[] }).tasks).toHaveLength(0);
    await expect(call("complete_task", bob, { title: "passport" })).rejects.toBeInstanceOf(ToolFailure);
    await expect(call("stop_timer", bob, {})).rejects.toThrow("No timer is running.");
  });

  it("asks before deleting and then deletes", async () => {
    const tool = toolByName.get("delete_task");
    expect(tool?.kind).toBe("destructive");
    const args = tool!.input.parse({ title: "Renew passport" });
    expect(await tool!.describe!(alice, args)).toContain("Renew passport");
    const result = await tool!.run(alice, args);
    expect(result.summary).toBe('Deleted task "Renew passport".');
  });
});
