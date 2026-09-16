import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import type { McpContext } from "@/mcp/context";
import { toolByName } from "@/mcp/registry";
import { ToolFailure } from "@/mcp/tools/write";
import { loadDayFacts } from "@/server/services/day";
import { listAccounts } from "@/server/services/money";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;
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

const at = (day: string) => `${day}T09:00:00Z`;

suite("money tools", () => {
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

  it("keeps account balances in step with every transaction", async () => {
    await call("set_account", alice, { name: "HDFC", kind: "bank", balance: 10000 });
    await call("set_account", alice, { name: "Amex", kind: "credit_card", balance: 0, creditLimit: 50000, dueDay: 15 });

    const lunch = await call("log_expense", alice, { amount: 250, category: "food", label: "lunch", account: "hdfc", timestamp: at(TODAY) });
    expect(lunch.summary).toBe("Spent ₹250 on food (lunch) from HDFC.");
    await call("log_expense", alice, { amount: 1200, category: "shopping", account: "amex", timestamp: at(TODAY) });
    await call("log_income", alice, { amount: 50000, label: "salary", account: "HDFC", timestamp: at(TODAY) });

    const accounts = await listAccounts(alice.userId);
    const byName = Object.fromEntries(accounts.map((a) => [a.name, a.balance]));
    expect(byName).toEqual({ HDFC: 59750, Amex: 1200 });
  });

  it("aggregates spend by category and income per day, ignoring transfers", async () => {
    const facts = await loadDayFacts(alice.userId, TODAY, TODAY);
    const day = facts.get(TODAY);
    expect(day?.spendByCategory).toEqual({ food: 250, shopping: 1200 });
    expect(day?.income).toBe(50000);
  });

  it("pays a monthly bill, records the payment as spend and queues the next one", async () => {
    await call("add_bill", alice, { name: "Electricity", amount: 1800, dueDate: "2026-09-20", recurrence: "monthly", account: "HDFC" });
    const paid = await call("pay_bill", alice, { name: "electr", date: TODAY });
    expect(paid.summary).toBe('Paid "Electricity" (₹1,800). Next one due 2026-10-20.');
    await expect(call("pay_bill", alice, { name: "electr", date: TODAY })).resolves.toMatchObject({
      summary: expect.stringContaining("Next one due 2026-11-20"),
    });

    const facts = await loadDayFacts(alice.userId, TODAY, TODAY);
    expect(facts.get(TODAY)?.spendByCategory.bills).toBe(3600);
    const hdfc = (await listAccounts(alice.userId)).find((a) => a.name === "HDFC");
    expect(hdfc?.balance).toBe(59750 - 3600);
  });

  it("summarises money for the model", async () => {
    const summary = await call("get_money_summary", alice, {});
    // Two payments pushed the monthly bill to November, outside the 30-day window.
    expect(summary.summary).toBe("Spent ₹5,050 today and ₹5,050 this month. 0 bill(s) due in 30 days.");
    const data = summary.data as {
      accounts: Array<{ name: string; nextDueDate: string | null }>;
      totalOwed: number;
      upcomingBills: unknown[];
    };
    expect(data.upcomingBills).toHaveLength(0);
    expect(data.totalOwed).toBe(1200);
    expect(data.accounts.find((a) => a.name === "Amex")?.nextDueDate).toBe("2026-10-15");
  });

  it("reverses balances when a transaction is deleted (after confirmation)", async () => {
    const summary = await call("get_money_summary", alice, {});
    const recent = (summary.data as { recent: Array<{ id: string; label: string | null }> }).recent;
    const lunch = recent.find((tx) => tx.label === "lunch")!;
    const tool = toolByName.get("delete_transaction")!;
    expect(tool.kind).toBe("destructive");
    expect(await tool.describe!(alice, { transactionId: lunch.id })).toContain("₹250");
    await tool.run(alice, { transactionId: lunch.id });
    const hdfc = (await listAccounts(alice.userId)).find((a) => a.name === "HDFC");
    expect(hdfc?.balance).toBe(59750 - 3600 + 250);
  });

  it("keeps users apart", async () => {
    expect((await call("get_money_summary", bob, {})).summary).toMatch(/^Spent ₹0 today/);
    await expect(call("log_expense", bob, { amount: 10, account: "HDFC" })).rejects.toBeInstanceOf(ToolFailure);
    await expect(call("pay_bill", bob, { name: "Electricity" })).rejects.toBeInstanceOf(ToolFailure);
  });
});
