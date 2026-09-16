"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import {
  accountInputSchema,
  billInputSchema,
  expenseInputSchema,
  incomeInputSchema,
  localDateSchema,
  transferInputSchema,
  uuidSchema,
} from "@/lib/validation";
import {
  addBill,
  archiveAccount,
  deleteBill,
  deleteTransaction,
  logExpense,
  logIncome,
  logTransfer,
  payBill,
  upsertAccount,
} from "@/server/services/money";
import { revalidateAll, withValidation } from "./helpers";

export async function saveAccountAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(accountInputSchema, input, async (value, ctx) => {
    await upsertAccount(ctx.user.id, value, ctx.profile.currency);
    revalidateAll();
    return ok();
  });
}

export async function archiveAccountAction(accountId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, accountId, async (id, ctx) => {
    const archived = await archiveAccount(ctx.user.id, id);
    if (!archived) return fail("Account not found");
    revalidateAll();
    return ok();
  });
}

export async function logExpenseAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(expenseInputSchema, input, async (value, ctx) => {
    await logExpense(ctx.user.id, ctx.timezone, value);
    revalidateAll();
    return ok();
  });
}

export async function logIncomeAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(incomeInputSchema, input, async (value, ctx) => {
    await logIncome(ctx.user.id, ctx.timezone, value);
    revalidateAll();
    return ok();
  });
}

export async function logTransferAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(transferInputSchema, input, async (value, ctx) => {
    await logTransfer(ctx.user.id, ctx.timezone, value);
    revalidateAll();
    return ok();
  });
}

export async function deleteTransactionAction(transactionId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, transactionId, async (id, ctx) => {
    const deleted = await deleteTransaction(ctx.user.id, id);
    if (!deleted) return fail("Transaction not found");
    revalidateAll();
    return ok();
  });
}

export async function addBillAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(billInputSchema, input, async (value, ctx) => {
    await addBill(ctx.user.id, value);
    revalidateAll();
    return ok();
  });
}

const payBillSchema = z.object({
  billId: uuidSchema,
  accountId: uuidSchema.nullish(),
  date: localDateSchema.nullish(),
});

export async function payBillAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(payBillSchema, input, async (value, ctx) => {
    const result = await payBill(ctx.user.id, ctx.timezone, value.billId, {
      accountId: value.accountId ?? null,
      date: value.date ?? null,
    });
    if (!result) return fail("Bill not found or already paid");
    revalidateAll();
    return ok();
  });
}

export async function deleteBillAction(billId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, billId, async (id, ctx) => {
    const deleted = await deleteBill(ctx.user.id, id);
    if (!deleted) return fail("Bill not found");
    revalidateAll();
    return ok();
  });
}
