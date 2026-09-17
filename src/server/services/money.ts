import "server-only";
import { and, asc, between, desc, eq, isNull, lte, sql } from "drizzle-orm";
import { db, type Database } from "@/db";
import { bills, moneyAccounts, transactions } from "@/db/schema";
import type { Bill, MoneyAccount, Transaction } from "@/db/schema";
import type { BillStatus, EntrySource, TransactionKind } from "@/lib/domain";
import { addDays, startOfMonth, startOfWeek, toLocalDate, type LocalDate } from "@/lib/date";
import { round } from "@/lib/goals";
import type {
  AccountInput,
  BillInput,
  ExpenseInput,
  IncomeInput,
  TransferInput,
} from "@/lib/validation";
import { eventTiming } from "./common";
import { loadDayFacts } from "./day";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// --- Accounts --------------------------------------------------------------

export async function listAccounts(userId: string, includeArchived = false): Promise<MoneyAccount[]> {
  const filters = [eq(moneyAccounts.userId, userId)];
  if (!includeArchived) filters.push(isNull(moneyAccounts.archivedAt));
  return db
    .select()
    .from(moneyAccounts)
    .where(and(...filters))
    .orderBy(asc(moneyAccounts.kind), asc(moneyAccounts.name));
}

export async function getAccount(userId: string, accountId: string): Promise<MoneyAccount | null> {
  return accountOn(db, userId, accountId);
}

/**
 * Account lookup on an explicit executor.
 *
 * Inside `db.transaction` the query **must** run on `tx`. The pool is `max: 1`
 * in production, so a lookup on the outer `db` would wait for the connection
 * the open transaction is holding, and the request would hang until the
 * serverless function timed out.
 */
async function accountOn(
  executor: Database | Tx,
  userId: string,
  accountId: string,
): Promise<MoneyAccount | null> {
  const [row] = await executor
    .select()
    .from(moneyAccounts)
    .where(and(eq(moneyAccounts.id, accountId), eq(moneyAccounts.userId, userId)))
    .limit(1);
  return row ?? null;
}

/** Create or update by name. A given `balance` overwrites the running one. */
export async function upsertAccount(
  userId: string,
  input: AccountInput,
  currency: string,
): Promise<MoneyAccount> {
  const set: Partial<typeof moneyAccounts.$inferInsert> = { kind: input.kind, archivedAt: null };
  if (input.balance !== undefined && input.balance !== null) set.balance = input.balance;
  if (input.creditLimit !== undefined) set.creditLimit = input.creditLimit ?? null;
  if (input.statementDay !== undefined) set.statementDay = input.statementDay ?? null;
  if (input.dueDay !== undefined) set.dueDay = input.dueDay ?? null;

  const [saved] = await db
    .insert(moneyAccounts)
    .values({
      userId,
      name: input.name,
      kind: input.kind,
      balance: input.balance ?? 0,
      creditLimit: input.creditLimit ?? null,
      statementDay: input.statementDay ?? null,
      dueDay: input.dueDay ?? null,
      currency,
    })
    .onConflictDoUpdate({ target: [moneyAccounts.userId, moneyAccounts.name], set })
    .returning();
  return saved;
}

export async function archiveAccount(userId: string, accountId: string): Promise<boolean> {
  const [archived] = await db
    .update(moneyAccounts)
    .set({ archivedAt: new Date() })
    .where(and(eq(moneyAccounts.id, accountId), eq(moneyAccounts.userId, userId)))
    .returning({ id: moneyAccounts.id });
  return Boolean(archived);
}

// --- Transactions ----------------------------------------------------------


/**
 * Signed effect of a transaction on an account's balance.
 * Cards hold what is *owed*, so spending on one increases the balance.
 */
function effectOn(account: MoneyAccount, kind: TransactionKind, amount: number, role: "from" | "to"): number {
  const owed = account.kind === "credit_card";
  if (role === "to") return owed ? -amount : amount; // money arriving: pays a card down, tops others up
  if (kind === "income") return owed ? -amount : amount;
  return owed ? amount : -amount; // expense / payment / transfer-out
}

async function adjust(tx: Tx, userId: string, accountId: string | null, delta: number): Promise<void> {
  if (!accountId || delta === 0) return;
  await tx
    .update(moneyAccounts)
    .set({ balance: sql`${moneyAccounts.balance} + ${delta}` })
    .where(and(eq(moneyAccounts.id, accountId), eq(moneyAccounts.userId, userId)));
}

interface NewTransaction {
  kind: TransactionKind;
  amount: number;
  category?: string | null;
  label?: string | null;
  accountId?: string | null;
  transferAccountId?: string | null;
  occurredAt?: string | null;
  notes?: string | null;
  importBatchId?: string | null;
}

/** Records a transaction and applies its balance effects atomically. */
export async function recordTransaction(
  userId: string,
  timezone: string,
  input: NewTransaction,
  source: EntrySource = "web",
): Promise<Transaction> {
  const { occurredAt, localDate } = eventTiming(timezone, input.occurredAt);
  return db.transaction(async (tx) => {
    const from = input.accountId ? await accountOn(tx, userId, input.accountId) : null;
    const to = input.transferAccountId ? await accountOn(tx, userId, input.transferAccountId) : null;
    if (input.accountId && !from) throw new Error("Account not found");
    if (input.transferAccountId && !to) throw new Error("Destination account not found");

    const [created] = await tx
      .insert(transactions)
      .values({
        userId,
        accountId: from?.id ?? null,
        transferAccountId: to?.id ?? null,
        amount: round(input.amount),
        kind: input.kind,
        category: (input.category ?? "other") as Transaction["category"],
        label: input.label ?? null,
        occurredAt,
        localDate,
        notes: input.notes ?? null,
        importBatchId: input.importBatchId ?? null,
        source,
      })
      .returning();

    if (from) await adjust(tx, userId, from.id, effectOn(from, input.kind, created.amount, "from"));
    if (to) await adjust(tx, userId, to.id, effectOn(to, input.kind, created.amount, "to"));
    return created;
  });
}

export const logExpense = (userId: string, timezone: string, input: ExpenseInput, source?: EntrySource) =>
  recordTransaction(userId, timezone, { ...input, kind: "expense" }, source);

export const logIncome = (userId: string, timezone: string, input: IncomeInput, source?: EntrySource) =>
  recordTransaction(userId, timezone, { ...input, kind: "income", category: "other" }, source);

export const logTransfer = (userId: string, timezone: string, input: TransferInput, source?: EntrySource) =>
  recordTransaction(
    userId,
    timezone,
    {
      kind: "transfer",
      amount: input.amount,
      label: input.label,
      accountId: input.fromAccountId,
      transferAccountId: input.toAccountId,
      occurredAt: input.occurredAt,
      category: "other",
    },
    source,
  );

export async function listTransactions(
  userId: string,
  options: { startDate?: LocalDate; endDate?: LocalDate; limit?: number } = {},
): Promise<Transaction[]> {
  const filters = [eq(transactions.userId, userId)];
  if (options.startDate && options.endDate) {
    filters.push(between(transactions.localDate, options.startDate, options.endDate));
  }
  return db
    .select()
    .from(transactions)
    .where(and(...filters))
    .orderBy(desc(transactions.occurredAt))
    .limit(options.limit ?? 50);
}

/** Deleting reverses the balance effects, so accounts stay consistent. */
export async function deleteTransaction(userId: string, transactionId: string): Promise<Transaction | null> {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(transactions)
      .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)))
      .returning();
    if (!deleted) return null;
    const from = deleted.accountId ? await accountOn(tx, userId, deleted.accountId) : null;
    const to = deleted.transferAccountId ? await accountOn(tx, userId, deleted.transferAccountId) : null;
    if (from) await adjust(tx, userId, from.id, -effectOn(from, deleted.kind, deleted.amount, "from"));
    if (to) await adjust(tx, userId, to.id, -effectOn(to, deleted.kind, deleted.amount, "to"));
    await tx.update(bills).set({ status: "pending", paidTransactionId: null }).where(eq(bills.paidTransactionId, deleted.id));
    return deleted;
  });
}

// --- Bills -----------------------------------------------------------------

export async function listBills(userId: string, status: BillStatus | "all" = "pending"): Promise<Bill[]> {
  const filters = [eq(bills.userId, userId)];
  if (status !== "all") filters.push(eq(bills.status, status));
  return db
    .select()
    .from(bills)
    .where(and(...filters))
    .orderBy(asc(bills.status), asc(bills.dueDate));
}

export async function getBill(userId: string, billId: string): Promise<Bill | null> {
  const row = await db.query.bills.findFirst({ where: and(eq(bills.id, billId), eq(bills.userId, userId)) });
  return row ?? null;
}

export async function addBill(userId: string, input: BillInput, source: EntrySource = "web"): Promise<Bill> {
  const [created] = await db
    .insert(bills)
    .values({
      userId,
      name: input.name,
      amount: input.amount,
      dueDate: input.dueDate,
      recurrence: input.recurrence,
      category: input.category,
      accountId: input.accountId ?? null,
      notes: input.notes ?? null,
      source,
    })
    .returning();
  return created;
}

function plusOneMonth(date: LocalDate): LocalDate {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
  next.setUTCDate(Math.min(d, lastDay));
  return next.toISOString().slice(0, 10);
}

/**
 * Pays a bill: records a payment transaction, marks the bill paid, and for a
 * monthly bill queues the next occurrence one month later.
 */
export async function payBill(
  userId: string,
  timezone: string,
  billId: string,
  options: { accountId?: string | null; date?: LocalDate | null } = {},
  source: EntrySource = "web",
): Promise<{ bill: Bill; transaction: Transaction; next: Bill | null } | null> {
  const bill = await getBill(userId, billId);
  if (!bill || bill.status === "paid") return null;

  const transaction = await recordTransaction(
    userId,
    timezone,
    {
      kind: "payment",
      amount: bill.amount,
      category: bill.category,
      label: bill.name,
      accountId: options.accountId ?? bill.accountId,
      occurredAt: options.date ? `${options.date}T12:00:00Z` : null,
    },
    source,
  );
  const [paid] = await db
    .update(bills)
    .set({ status: "paid", paidTransactionId: transaction.id })
    .where(eq(bills.id, bill.id))
    .returning();

  let next: Bill | null = null;
  if (bill.recurrence === "monthly") {
    next = await addBill(
      userId,
      {
        name: bill.name,
        amount: bill.amount,
        dueDate: plusOneMonth(bill.dueDate),
        recurrence: "monthly",
        category: bill.category,
        accountId: bill.accountId,
        notes: bill.notes,
      },
      source,
    );
  }
  return { bill: paid, transaction, next };
}

export async function deleteBill(userId: string, billId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(bills)
    .where(and(eq(bills.id, billId), eq(bills.userId, userId)))
    .returning({ id: bills.id });
  return Boolean(deleted);
}

// --- Summary ---------------------------------------------------------------

export interface MoneySummary {
  currency: string;
  today: LocalDate;
  spentToday: number;
  spentThisWeek: number;
  spentThisMonth: number;
  incomeThisMonth: number;
  byCategoryThisMonth: Record<string, number>;
  accounts: Array<{
    id: string;
    name: string;
    kind: MoneyAccount["kind"];
    balance: number;
    creditLimit: number | null;
    nextDueDate: LocalDate | null;
  }>;
  netAvailable: number;
  totalOwed: number;
  upcomingBills: Array<{ id: string; name: string; amount: number; dueDate: LocalDate; overdue: boolean }>;
  upcomingBillsTotal: number;
  recent: Transaction[];
}

/** Next calendar day-of-month `day` on or after `today`. */
function nextDueDate(day: number | null, today: LocalDate): LocalDate | null {
  if (!day) return null;
  const [y, m, d] = today.split("-").map(Number);
  const inThisMonth = (() => {
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return new Date(Date.UTC(y, m - 1, Math.min(day, last))).toISOString().slice(0, 10);
  })();
  if (day >= d) return inThisMonth;
  return plusOneMonth(inThisMonth);
}

export async function getMoneySummary(
  userId: string,
  timezone: string,
  currency: string,
  today: LocalDate = toLocalDate(new Date(), timezone),
): Promise<MoneySummary> {
  const monthStart = startOfMonth(today);
  const weekStart = startOfWeek(today);
  const rangeStart = monthStart < weekStart ? monthStart : weekStart;

  const [facts, accounts, pending, recent] = await Promise.all([
    loadDayFacts(userId, rangeStart, today),
    listAccounts(userId),
    db
      .select()
      .from(bills)
      .where(and(eq(bills.userId, userId), eq(bills.status, "pending"), lte(bills.dueDate, addDays(today, 30))))
      .orderBy(asc(bills.dueDate)),
    listTransactions(userId, { limit: 20 }),
  ]);

  const spendOf = (date: LocalDate) =>
    Object.values(facts.get(date)?.spendByCategory ?? {}).reduce((sum, value) => sum + value, 0);
  const sumRange = (start: LocalDate) => {
    let total = 0;
    for (const [date, day] of facts) {
      if (date >= start) total += Object.values(day.spendByCategory).reduce((s, v) => s + v, 0);
    }
    return round(total);
  };
  const byCategory: Record<string, number> = {};
  let incomeThisMonth = 0;
  for (const [date, day] of facts) {
    if (date < monthStart) continue;
    incomeThisMonth += day.income;
    for (const [category, amount] of Object.entries(day.spendByCategory)) {
      byCategory[category] = round((byCategory[category] ?? 0) + amount);
    }
  }

  const owed = accounts.filter((a) => a.kind === "credit_card").reduce((s, a) => s + a.balance, 0);
  const available = accounts.filter((a) => a.kind !== "credit_card").reduce((s, a) => s + a.balance, 0);

  return {
    currency,
    today,
    spentToday: round(spendOf(today)),
    spentThisWeek: sumRange(weekStart),
    spentThisMonth: sumRange(monthStart),
    incomeThisMonth: round(incomeThisMonth),
    byCategoryThisMonth: byCategory,
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      kind: account.kind,
      balance: round(account.balance),
      creditLimit: account.creditLimit,
      nextDueDate: account.kind === "credit_card" ? nextDueDate(account.dueDay, today) : null,
    })),
    netAvailable: round(available),
    totalOwed: round(owed),
    upcomingBills: pending.map((bill) => ({
      id: bill.id,
      name: bill.name,
      amount: bill.amount,
      dueDate: bill.dueDate,
      overdue: bill.dueDate < today,
    })),
    upcomingBillsTotal: round(pending.reduce((sum, bill) => sum + bill.amount, 0)),
    recent,
  };
}
