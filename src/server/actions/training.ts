"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import {
  dayKeySchema,
  rewardInputSchema,
  setPerformanceSchema,
  trainingPreferencesSchema,
  uuidSchema,
} from "@/lib/validation";
import {
  completeSet,
  saveTrainingPreferences,
  sessionReport,
  startPlannedWorkout,
  type SetResult,
} from "@/server/services/training";
import { claimMission, createReward, redeemReward, setRewardActive } from "@/server/services/rpg";
import { setWorkoutCompletion } from "@/server/services/workouts";
import { revalidateAll, withValidation } from "./helpers";

export async function saveTrainingPreferencesAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(trainingPreferencesSchema, input, async (value, ctx) => {
    await saveTrainingPreferences(ctx.user.id, value);
    revalidateAll();
    return ok();
  });
}

const startSchema = z.object({ day: dayKeySchema.nullish() });

export async function startPlannedWorkoutAction(
  input: unknown,
): Promise<ActionResult<{ workoutId: string; resumed: boolean }>> {
  return withValidation(startSchema, input, async (value, ctx) => {
    const { workout, resumed } = await startPlannedWorkout(ctx.user.id, ctx.timezone, { day: value.day ?? null });
    revalidateAll();
    return ok({ workoutId: workout.id, resumed });
  });
}

const completeSchema = setPerformanceSchema.extend({ setId: uuidSchema });

/** Completes one set and reports the XP and any PR it earned, for the session screen. */
export async function completeSetAction(input: unknown): Promise<ActionResult<SetResult>> {
  return withValidation(completeSchema, input, async ({ setId, ...values }, ctx) => {
    const result = await completeSet(ctx.user.id, setId, values);
    if (!result) return fail("Set not found");
    revalidateAll();
    return ok(result);
  });
}

export async function finishWorkoutAction(
  workoutId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof sessionReport>>>> {
  return withValidation(uuidSchema, workoutId, async (id, ctx) => {
    const done = await setWorkoutCompletion(ctx.user.id, id, true);
    if (!done) return fail("Workout not found");
    revalidateAll();
    return ok(await sessionReport(ctx.user.id, id));
  });
}

export async function claimMissionAction(key: string): Promise<ActionResult<{ xp: number; gold: number }>> {
  return withValidation(z.string().trim().min(1).max(80), key, async (value, ctx) => {
    const result = await claimMission(ctx.user.id, ctx.timezone, value);
    if (!result.ok) return fail(result.error);
    revalidateAll();
    return ok({ xp: result.mission.xp, gold: result.mission.gold });
  });
}

export async function createRewardAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(rewardInputSchema, input, async (value, ctx) => {
    await createReward(ctx.user.id, value);
    revalidateAll();
    return ok();
  });
}

export async function removeRewardAction(rewardId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, rewardId, async (id, ctx) => {
    const updated = await setRewardActive(ctx.user.id, id, false);
    if (!updated) return fail("Reward not found");
    revalidateAll();
    return ok();
  });
}

export async function redeemRewardAction(rewardId: string): Promise<ActionResult<{ balance: number }>> {
  return withValidation(uuidSchema, rewardId, async (id, ctx) => {
    const result = await redeemReward(ctx.user.id, id);
    if (!result.ok) return fail(result.error);
    revalidateAll();
    return ok({ balance: result.balance });
  });
}
