"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { areaKeySchema, timeEntryInputSchema, uuidSchema } from "@/lib/validation";
import {
  deleteTimeEntry,
  logTimeEntry,
  startTimer,
  stopTimer,
} from "@/server/services/time";
import { revalidateAll, withValidation } from "./helpers";

const startSchema = z.object({
  category: areaKeySchema,
  label: z.string().trim().max(120).nullish(),
});

export async function startTimerAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(startSchema, input, async (value, ctx) => {
    await startTimer(ctx.user.id, ctx.timezone, value.category, value.label ?? null);
    revalidateAll();
    return ok();
  });
}

export async function stopTimerAction(): Promise<ActionResult<{ minutes: number }>> {
  return withValidation(z.undefined(), undefined, async (_value, ctx) => {
    const stopped = await stopTimer(ctx.user.id);
    if (!stopped) return fail("No timer is running");
    revalidateAll();
    return ok({ minutes: stopped.durationMinutes ?? 0 });
  });
}

export async function logTimeAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(timeEntryInputSchema, input, async (value, ctx) => {
    await logTimeEntry(ctx.user.id, ctx.timezone, value);
    revalidateAll();
    return ok();
  });
}

export async function deleteTimeEntryAction(entryId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, entryId, async (id, ctx) => {
    const deleted = await deleteTimeEntry(ctx.user.id, id);
    if (!deleted) return fail("Entry not found");
    revalidateAll();
    return ok();
  });
}
