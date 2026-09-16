import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import type { McpContext } from "@/mcp/context";
import { toolByName } from "@/mcp/registry";
import { ToolFailure } from "@/mcp/tools/write";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

// A Wednesday, so routine/weekday assertions are deterministic.
const TODAY = "2026-09-16";

async function createUser(label: string): Promise<McpContext> {
  const username = `vitest-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [user] = await db.insert(users).values({ username }).returning();
  await db.insert(profiles).values({ userId: user.id, timezone: "UTC" });
  return { userId: user.id, timezone: "UTC", today: TODAY, source: "assistant" };
}

const call = (name: string, ctx: McpContext, args: Record<string, unknown>) => {
  const tool = toolByName.get(name);
  if (!tool) throw new Error(`no tool ${name}`);
  return tool.run(ctx, tool.input.parse(args));
};

suite("career and plan tools", () => {
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

  it("moves an application through the pipeline and stamps appliedOn", async () => {
    const added = await call("add_application", alice, { company: "Acme", role: "Senior Engineer" });
    expect(added.summary).toBe("Added Senior Engineer at Acme (wishlist).");
    expect((added.data as { appliedOn: string | null }).appliedOn).toBeNull();

    const moved = await call("update_application", alice, { company: "acme", stage: "applied" });
    expect(moved.summary).toBe("Moved Senior Engineer at Acme to applied.");
    expect((moved.data as { appliedOn: string | null }).appliedOn).toBe(TODAY);

    const listed = await call("list_applications", alice, {});
    expect(listed.summary).toBe("1 application(s): 1 applied.");
  });

  it("asks before archiving, then hides the application", async () => {
    const tool = toolByName.get("archive_application")!;
    const args = tool.input.parse({ company: "Acme" });
    expect(await tool.describe!(alice, args)).toBe("Archive the application for Senior Engineer at Acme?");
    await tool.run(alice, args);
    const listed = await call("list_applications", alice, {});
    expect(listed.summary).toBe("No applications yet.");
  });

  it("plans a day from routines idempotently and completes blocks by label", async () => {
    await call("add_routine", alice, { label: "Gym", startTime: "07:00", endTime: "08:00", weekdays: ["mon", "wed", "fri"] });
    await call("add_routine", alice, { label: "Weekend run", startTime: "09:00", endTime: "10:00", weekdays: ["sat"] });

    const first = await call("plan_day", alice, {});
    expect(first.summary).toBe(`Planned ${TODAY}: 1 routine block(s) added, 1 in total.`);
    const second = await call("plan_day", alice, {});
    expect(second.summary).toBe(`Planned ${TODAY}: 0 routine block(s) added, 1 in total.`);

    await call("add_block", alice, { startTime: "20:00", endTime: "21:00", label: "System design prep", kind: "study" });
    const done = await call("complete_block", alice, { label: "gym" });
    expect(done.summary).toBe(`Completed "Gym" on ${TODAY}.`);

    const plan = await call("get_day_plan", alice, {});
    const data = plan.data as { blocks: Array<{ label: string; done: boolean }> };
    expect(data.blocks.map((b) => [b.label, b.done])).toEqual([
      ["Gym", true],
      ["System design prep", false],
    ]);
  });

  it("removes a routine after confirmation", async () => {
    const tool = toolByName.get("remove_routine")!;
    expect(tool.kind).toBe("destructive");
    const args = tool.input.parse({ label: "weekend" });
    expect(await tool.describe!(alice, args)).toContain("Weekend run");
    const result = await tool.run(alice, args);
    expect(result.summary).toBe('Removed routine "Weekend run".');
  });

  it("keeps users apart", async () => {
    const plan = await call("get_day_plan", bob, {});
    expect(plan.summary).toBe(`Nothing planned for ${TODAY} yet.`);
    await expect(call("complete_block", bob, { label: "gym" })).rejects.toBeInstanceOf(ToolFailure);
    await expect(call("update_application", bob, { company: "Acme", stage: "offer" })).rejects.toBeInstanceOf(ToolFailure);
  });
});
