"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import {
  foodLogInputSchema,
  foodInputSchema,
  noteInputSchema,
  sleepInputSchema,
  uuidSchema,
  waterInputSchema,
  weightInputSchema,
  goalEntryInputSchema,
} from "@/lib/validation";
import {
  applyMealTemplate,
  createMealTemplateFromDay,
  deleteFood,
  deleteFoodLog,
  deleteMealTemplate,
  duplicateFoodLog,
  logFood,
  updateFoodLog,
  upsertFood,
} from "@/server/services/food";
import { deleteWaterLog, logWater } from "@/server/services/water";
import {
  deleteSleepEntry,
  deleteWeightEntry,
  logSleep,
  logWeight,
} from "@/server/services/body";
import { addNote, deleteNote } from "@/server/services/notes";
import { clearGoalEntries, recordGoalEntry } from "@/server/services/goals";
import { mealTypeSchema } from "@/lib/validation";
import { revalidateAll, withValidation } from "./helpers";

export async function logFoodAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withValidation(foodLogInputSchema, input, async (value, ctx) => {
    const created = await logFood(ctx.user.id, ctx.timezone, value);
    revalidateAll();
    return ok({ id: created.id });
  });
}

export async function updateFoodLogAction(
  logId: string,
  input: unknown,
): Promise<ActionResult<undefined>> {
  return withValidation(foodLogInputSchema, input, async (value, ctx) => {
    const updated = await updateFoodLog(ctx.user.id, logId, value, ctx.timezone);
    if (!updated) return fail("Entry not found");
    revalidateAll();
    return ok();
  });
}

export async function deleteFoodLogAction(logId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, logId, async (id, ctx) => {
    const deleted = await deleteFoodLog(ctx.user.id, id);
    if (!deleted) return fail("Entry not found");
    revalidateAll();
    return ok();
  });
}

export async function duplicateFoodLogAction(logId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, logId, async (id, ctx) => {
    const created = await duplicateFoodLog(ctx.user.id, id, ctx.timezone);
    if (!created) return fail("Entry not found");
    revalidateAll();
    return ok();
  });
}

export async function saveFoodAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(foodInputSchema, input, async (value, ctx) => {
    await upsertFood(ctx.user.id, value);
    revalidateAll();
    return ok();
  });
}

export async function deleteFoodAction(foodId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, foodId, async (id, ctx) => {
    const deleted = await deleteFood(ctx.user.id, id);
    if (!deleted) return fail("Food not found");
    revalidateAll();
    return ok();
  });
}

const mealTemplateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  mealType: mealTypeSchema,
  logIds: z.array(uuidSchema).min(1, "Select at least one entry"),
});

export async function saveMealTemplateAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(mealTemplateSchema, input, async (value, ctx) => {
    const id = await createMealTemplateFromDay(
      ctx.user.id,
      value.name,
      value.mealType,
      value.logIds,
    );
    if (!id) return fail("Could not build a template from those entries");
    revalidateAll();
    return ok();
  });
}

export async function applyMealTemplateAction(
  templateId: string,
): Promise<ActionResult<{ count: number }>> {
  return withValidation(uuidSchema, templateId, async (id, ctx) => {
    const count = await applyMealTemplate(ctx.user.id, id, ctx.timezone);
    if (count === 0) return fail("That meal template is empty");
    revalidateAll();
    return ok({ count });
  });
}

export async function deleteMealTemplateAction(
  templateId: string,
): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, templateId, async (id, ctx) => {
    const deleted = await deleteMealTemplate(ctx.user.id, id);
    if (!deleted) return fail("Template not found");
    revalidateAll();
    return ok();
  });
}

export async function logWaterAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(waterInputSchema, input, async (value, ctx) => {
    await logWater(ctx.user.id, ctx.timezone, value.milliliters, value.occurredAt);
    revalidateAll();
    return ok();
  });
}

export async function deleteWaterLogAction(logId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, logId, async (id, ctx) => {
    const deleted = await deleteWaterLog(ctx.user.id, id);
    if (!deleted) return fail("Entry not found");
    revalidateAll();
    return ok();
  });
}

export async function logWeightAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(weightInputSchema, input, async (value, ctx) => {
    await logWeight(ctx.user.id, ctx.timezone, value.kilograms, value.occurredAt, value.note);
    revalidateAll();
    return ok();
  });
}

export async function deleteWeightAction(entryId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, entryId, async (id, ctx) => {
    const deleted = await deleteWeightEntry(ctx.user.id, id);
    if (!deleted) return fail("Entry not found");
    revalidateAll();
    return ok();
  });
}

export async function logSleepAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(sleepInputSchema, input, async (value, ctx) => {
    await logSleep(ctx.user.id, ctx.timezone, value);
    revalidateAll();
    return ok();
  });
}

export async function deleteSleepAction(entryId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, entryId, async (id, ctx) => {
    const deleted = await deleteSleepEntry(ctx.user.id, id);
    if (!deleted) return fail("Entry not found");
    revalidateAll();
    return ok();
  });
}

export async function addNoteAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(noteInputSchema, input, async (value, ctx) => {
    await addNote(ctx.user.id, ctx.timezone, value.note, value.date);
    revalidateAll();
    return ok();
  });
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, noteId, async (id, ctx) => {
    const deleted = await deleteNote(ctx.user.id, id);
    if (!deleted) return fail("Note not found");
    revalidateAll();
    return ok();
  });
}

export async function recordGoalEntryAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(goalEntryInputSchema, input, async (value, ctx) => {
    const result = await recordGoalEntry(ctx.user.id, value.goalId, {
      date: value.date,
      value: value.value,
      note: value.note,
      timezone: ctx.timezone,
    });
    if (!result) return fail("Goal not found");
    revalidateAll();
    return ok();
  });
}

const clearEntrySchema = z.object({ goalId: uuidSchema, date: z.string() });

export async function clearGoalEntryAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(clearEntrySchema, input, async (value, ctx) => {
    await clearGoalEntries(ctx.user.id, value.goalId, value.date);
    revalidateAll();
    return ok();
  });
}
