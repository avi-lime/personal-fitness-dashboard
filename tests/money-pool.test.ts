import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import postgres from "postgres";

/**
 * Regression guard for the production-only deadlock.
 *
 * Serverless runs the pool at `max: 1`, so any query issued on the outer
 * client while a transaction holds that connection waits forever. Logging an
 * expense against an account did exactly that and only ever failed in
 * production. This test seeds the cached client with a `max: 1` pool *before*
 * importing the service, so the same shape would hang here too.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const suite = hasDatabase ? describe : describe.skip;

const globalForDb = globalThis as unknown as {
  __lifeDashboardSql?: ReturnType<typeof postgres>;
};
if (hasDatabase) {
  globalForDb.__lifeDashboardSql = postgres(process.env.DATABASE_URL as string, {
    max: 1,
    prepare: false,
  });
}

const { db } = await import("@/db");
const { profiles, users } = await import("@/db/schema");
const { deleteTransaction, getAccount, logExpense, logIncome, upsertAccount } = await import(
  "@/server/services/money"
);

suite("money writes on a single-connection pool", () => {
  let userId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({ username: `vitest-pool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` })
      .returning();
    userId = user.id;
    await db.insert(profiles).values({ userId, timezone: "UTC" });
  });

  afterAll(async () => {
    if (userId) await db.delete(users).where(eq(users.id, userId));
  });

  it("logs an expense against an account and moves the balance", async () => {
    const account = await upsertAccount(userId, { name: "Bank", kind: "bank", balance: 1000 }, "INR");

    const tx = await logExpense(userId, "UTC", {
      amount: 250,
      category: "food",
      accountId: account.id,
      label: "lunch",
    });

    expect(tx.kind).toBe("expense");
    expect((await getAccount(userId, account.id))?.balance).toBe(750);
  }, 10_000);

  it("logs income and reverses a deletion, both inside a transaction", async () => {
    const account = await upsertAccount(userId, { name: "Salary", kind: "bank", balance: 0 }, "INR");

    const income = await logIncome(userId, "UTC", { amount: 5000, accountId: account.id });
    expect((await getAccount(userId, account.id))?.balance).toBe(5000);

    await deleteTransaction(userId, income.id);
    expect((await getAccount(userId, account.id))?.balance).toBe(0);
  }, 10_000);

  it("charges a credit card instead of draining it", async () => {
    const card = await upsertAccount(userId, { name: "Card", kind: "credit_card", balance: 0 }, "INR");

    await logExpense(userId, "UTC", { amount: 400, category: "shopping", accountId: card.id });

    expect((await getAccount(userId, card.id))?.balance).toBe(400);
  }, 10_000);
});
