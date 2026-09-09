"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { goalInputSchema, goalUpdateSchema, uuidSchema } from "@/lib/validation";
import { archiveGoal, createGoal, reorderGoals, updateGoal } from "@/server/services/goals";
import { revalidateAll, withValidation } from "./helpers";

export async function createGoalAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withValidation(goalInputSchema, input, async (value, ctx) => {
    const goal = await createGoal(ctx.user.id, value);
    revalidateAll();
    return ok({ id: goal.id });
  });
}

const updateSchema = z.object({ goalId: uuidSchema, patch: goalUpdateSchema });

export async function updateGoalAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(updateSchema, input, async (value, ctx) => {
    const updated = await updateGoal(ctx.user.id, value.goalId, value.patch);
    if (!updated) return fail("Goal not found");
    revalidateAll();
    return ok();
  });
}

export async function archiveGoalAction(goalId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, goalId, async (id, ctx) => {
    const archived = await archiveGoal(ctx.user.id, id);
    if (!archived) return fail("Goal not found");
    revalidateAll();
    return ok();
  });
}

export async function reorderGoalsAction(orderedIds: string[]): Promise<ActionResult<undefined>> {
  return withValidation(z.array(uuidSchema).min(1), orderedIds, async (ids, ctx) => {
    await reorderGoals(ctx.user.id, ids);
    revalidateAll();
    return ok();
  });
}
