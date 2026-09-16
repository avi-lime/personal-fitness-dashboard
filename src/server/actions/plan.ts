"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { localDateSchema, routineInputSchema, timeBlockInputSchema, uuidSchema } from "@/lib/validation";
import { toLocalDate } from "@/lib/date";
import {
  addBlock,
  createRoutine,
  deleteBlock,
  deleteRoutine,
  planDay,
  setBlockDone,
  setRoutineActive,
} from "@/server/services/plan";
import { revalidateAll, withValidation } from "./helpers";

export async function planDayAction(date: string | null): Promise<ActionResult<{ added: number }>> {
  return withValidation(localDateSchema.nullable(), date, async (value, ctx) => {
    const { added } = await planDay(ctx.user.id, value ?? toLocalDate(new Date(), ctx.timezone));
    revalidateAll();
    return ok({ added });
  });
}

export async function addBlockAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(timeBlockInputSchema, input, async (value, ctx) => {
    await addBlock(ctx.user.id, value.date ?? toLocalDate(new Date(), ctx.timezone), value);
    revalidateAll();
    return ok();
  });
}

const doneSchema = z.object({ blockId: uuidSchema, done: z.boolean() });

export async function setBlockDoneAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(doneSchema, input, async (value, ctx) => {
    const updated = await setBlockDone(ctx.user.id, value.blockId, value.done);
    if (!updated) return fail("Block not found");
    revalidateAll();
    return ok();
  });
}

export async function deleteBlockAction(blockId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, blockId, async (id, ctx) => {
    const deleted = await deleteBlock(ctx.user.id, id);
    if (!deleted) return fail("Block not found");
    revalidateAll();
    return ok();
  });
}

export async function createRoutineAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(routineInputSchema, input, async (value, ctx) => {
    await createRoutine(ctx.user.id, value);
    revalidateAll();
    return ok();
  });
}

const activeSchema = z.object({ routineId: uuidSchema, active: z.boolean() });

export async function setRoutineActiveAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(activeSchema, input, async (value, ctx) => {
    const updated = await setRoutineActive(ctx.user.id, value.routineId, value.active);
    if (!updated) return fail("Routine not found");
    revalidateAll();
    return ok();
  });
}

export async function deleteRoutineAction(routineId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, routineId, async (id, ctx) => {
    const deleted = await deleteRoutine(ctx.user.id, id);
    if (!deleted) return fail("Routine not found");
    revalidateAll();
    return ok();
  });
}
