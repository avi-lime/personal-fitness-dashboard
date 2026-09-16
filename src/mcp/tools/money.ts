import "server-only";
import { defineTool } from "../registry";
import { recordMutation } from "../audit";
import { ToolFailure } from "./write";
import { findOneByName } from "./match";
import * as schemas from "../schemas";
import {
  addBill,
  deleteTransaction,
  getMoneySummary,
  listAccounts,
  listBills,
  logExpense,
  logIncome,
  payBill,
  upsertAccount,
} from "@/server/services/money";
import { getProfileFor } from "@/server/services/profile";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import type { MoneyAccount, Transaction } from "@/db/schema";
import type { McpContext } from "../context";

async function currencyOf(ctx: McpContext): Promise<string> {
  return (await getProfileFor(ctx.userId)).currency;
}

async function resolveAccount(ctx: McpContext, name?: string): Promise<MoneyAccount | null> {
  if (!name) return null;
  const accounts = await listAccounts(ctx.userId);
  return findOneByName(accounts, name, (account) => account.name, "account");
}

function txView(t: Transaction) {
  return {
    id: t.id,
    kind: t.kind,
    amount: t.amount,
    category: t.category,
    label: t.label,
    accountId: t.accountId,
    date: t.localDate,
    at: t.occurredAt.toISOString(),
  };
}

export const moneyTools = [
  defineTool({
    name: "log_expense",
    title: "Log expense",
    kind: "write",
    input: schemas.logExpenseInput,
    description:
      "Records money spent: amount, optional category (food, transport, rent, utilities, shopping, health, entertainment, subscriptions, education, bills, other), label and account. Defaults to now.",
    async run(ctx, args) {
      const [currency, account] = await Promise.all([currencyOf(ctx), resolveAccount(ctx, args.account)]);
      const tx = await logExpense(
        ctx.userId,
        ctx.timezone,
        {
          amount: args.amount,
          category: args.category ?? "other",
          label: args.label ?? null,
          accountId: account?.id ?? null,
          occurredAt: args.timestamp ?? null,
          notes: args.notes ?? null,
        },
        ctx.source,
      );
      const summary = `Spent ${formatMoney(tx.amount, currency)} on ${EXPENSE_CATEGORY_LABELS[tx.category].toLowerCase()}${tx.label ? ` (${tx.label})` : ""}${account ? ` from ${account.name}` : ""}.`;
      await recordMutation(ctx.userId, "log_expense", args, summary, ctx.source);
      return { summary, data: txView(tx) };
    },
  }),
  defineTool({
    name: "log_income",
    title: "Log income",
    kind: "write",
    input: schemas.logIncomeInput,
    description: "Records money received (salary, freelance payment…), optionally into a named account.",
    async run(ctx, args) {
      const [currency, account] = await Promise.all([currencyOf(ctx), resolveAccount(ctx, args.account)]);
      const tx = await logIncome(
        ctx.userId,
        ctx.timezone,
        {
          amount: args.amount,
          label: args.label ?? null,
          accountId: account?.id ?? null,
          occurredAt: args.timestamp ?? null,
          notes: args.notes ?? null,
        },
        ctx.source,
      );
      const summary = `Received ${formatMoney(tx.amount, currency)}${tx.label ? ` (${tx.label})` : ""}${account ? ` into ${account.name}` : ""}.`;
      await recordMutation(ctx.userId, "log_income", args, summary, ctx.source);
      return { summary, data: txView(tx) };
    },
  }),
  defineTool({
    name: "add_bill",
    title: "Add bill",
    kind: "write",
    input: schemas.addBillInput,
    description:
      "Adds a pending bill or payment due on a date; monthly bills re-create themselves when paid. Use pay_bill when it is paid.",
    async run(ctx, args) {
      const [currency, account] = await Promise.all([currencyOf(ctx), resolveAccount(ctx, args.account)]);
      const bill = await addBill(
        ctx.userId,
        {
          name: args.name,
          amount: args.amount,
          dueDate: args.dueDate,
          recurrence: args.recurrence ?? "none",
          category: args.category ?? "bills",
          accountId: account?.id ?? null,
          notes: args.notes ?? null,
        },
        ctx.source,
      );
      const summary = `Added bill "${bill.name}" of ${formatMoney(bill.amount, currency)} due ${bill.dueDate}${bill.recurrence === "monthly" ? " (monthly)" : ""}.`;
      await recordMutation(ctx.userId, "add_bill", args, summary, ctx.source);
      return { summary, data: { id: bill.id, name: bill.name, amount: bill.amount, dueDate: bill.dueDate, recurrence: bill.recurrence } };
    },
  }),
  defineTool({
    name: "pay_bill",
    title: "Pay bill",
    kind: "write",
    input: schemas.payBillInput,
    description:
      "Marks a pending bill paid (by billId or name), records the payment as spend, and queues the next occurrence for monthly bills.",
    async run(ctx, args) {
      const [currency, account, pending] = await Promise.all([
        currencyOf(ctx),
        resolveAccount(ctx, args.account),
        listBills(ctx.userId, "pending"),
      ]);
      const bill = args.billId
        ? pending.find((entry) => entry.id === args.billId)
        : findOneByName(pending, args.name ?? "", (entry) => entry.name, "pending bill");
      if (!bill) throw new ToolFailure(`No pending bill with id ${args.billId}.`);
      const result = await payBill(
        ctx.userId,
        ctx.timezone,
        bill.id,
        { accountId: account?.id ?? null, date: args.date ?? null },
        ctx.source,
      );
      if (!result) throw new ToolFailure(`"${bill.name}" is already paid.`);
      const summary = `Paid "${bill.name}" (${formatMoney(bill.amount, currency)}).${result.next ? ` Next one due ${result.next.dueDate}.` : ""}`;
      await recordMutation(ctx.userId, "pay_bill", args, summary, ctx.source);
      return { summary, data: { bill: { id: result.bill.id, status: result.bill.status }, transaction: txView(result.transaction), next: result.next ? { id: result.next.id, dueDate: result.next.dueDate } : null } };
    },
  }),
  defineTool({
    name: "set_account",
    title: "Set account",
    kind: "write",
    input: schemas.setAccountInput,
    description:
      "Creates or updates a money account by name — bank, cash, wallet or credit card (with limit and due day). Giving a balance overwrites the running balance; use it to correct drift.",
    async run(ctx, args) {
      const currency = await currencyOf(ctx);
      const account = await upsertAccount(ctx.userId, { ...args, kind: args.kind ?? "bank" }, currency);
      const summary = `Account "${account.name}" (${account.kind.replace("_", " ")}) set: balance ${formatMoney(account.balance, currency)}.`;
      await recordMutation(ctx.userId, "set_account", args, summary, ctx.source);
      return { summary, data: { id: account.id, name: account.name, kind: account.kind, balance: account.balance, creditLimit: account.creditLimit, dueDay: account.dueDay } };
    },
  }),
  defineTool({
    name: "get_money_summary",
    title: "Get money summary",
    kind: "read",
    input: schemas.getMoneySummaryInput,
    description:
      "Spend today / this week / this month (by category), income this month, every account with its balance (cards: amount owed and next due date), upcoming and overdue bills, and the 20 most recent transactions.",
    async run(ctx) {
      const currency = await currencyOf(ctx);
      const summary = await getMoneySummary(ctx.userId, ctx.timezone, currency, ctx.today);
      const overdue = summary.upcomingBills.filter((bill) => bill.overdue).length;
      return {
        summary: `Spent ${formatMoney(summary.spentToday, currency)} today and ${formatMoney(summary.spentThisMonth, currency)} this month. ${summary.upcomingBills.length} bill(s) due in 30 days${overdue ? `, ${overdue} overdue` : ""}.`,
        data: { ...summary, recent: summary.recent.map(txView) },
      };
    },
  }),
  defineTool({
    name: "delete_transaction",
    title: "Delete transaction",
    kind: "destructive",
    input: schemas.deleteTransactionInput,
    description: "Removes a logged transaction and reverses its effect on the account balance. Confirm with the user first.",
    async describe(ctx, args) {
      const currency = await currencyOf(ctx);
      const summary = await getMoneySummary(ctx.userId, ctx.timezone, currency, ctx.today);
      const tx = summary.recent.find((entry) => entry.id === args.transactionId);
      return tx
        ? `Delete the ${tx.kind} of ${formatMoney(tx.amount, currency)}${tx.label ? ` (${tx.label})` : ""} on ${tx.localDate}?`
        : `Delete transaction ${args.transactionId}?`;
    },
    async run(ctx, args) {
      const deleted = await deleteTransaction(ctx.userId, args.transactionId);
      if (!deleted) throw new ToolFailure(`No transaction with id ${args.transactionId}.`);
      const currency = await currencyOf(ctx);
      const summary = `Deleted the ${deleted.kind} of ${formatMoney(deleted.amount, currency)}${deleted.label ? ` (${deleted.label})` : ""}.`;
      await recordMutation(ctx.userId, "delete_transaction", args, summary, ctx.source);
      return { summary, data: { id: deleted.id, deleted: true } };
    },
  }),
];
