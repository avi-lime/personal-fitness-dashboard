"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { exerciseInputSchema, setInputSchema, uuidSchema, workoutInputSchema } from "@/lib/validation";
import {
  addExercise,
  addSet,
  createWorkout,
  deleteExercise,
  deleteSet,
  deleteWorkout,
  deleteWorkoutTemplate,
  saveWorkoutAsTemplate,
  setWorkoutCompletion,
  updateSet,
  updateWorkout,
} from "@/server/services/workouts";
import { revalidateAll, withValidation } from "./helpers";

export async function createWorkoutAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withValidation(workoutInputSchema, input, async (value, ctx) => {
    const workout = await createWorkout(ctx.user.id, ctx.timezone, value);
    revalidateAll();
    return ok({ id: workout.id });
  });
}

const updateWorkoutSchema = z.object({
  workoutId: uuidSchema,
  name: z.string().trim().min(1).max(80).optional(),
  notes: z.string().trim().max(1000).nullish(),
});

export async function updateWorkoutAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(updateWorkoutSchema, input, async (value, ctx) => {
    const updated = await updateWorkout(ctx.user.id, value.workoutId, {
      name: value.name,
      notes: value.notes ?? null,
    });
    if (!updated) return fail("Workout not found");
    revalidateAll();
    return ok();
  });
}

const completionSchema = z.object({ workoutId: uuidSchema, completed: z.boolean() });

export async function setWorkoutCompletionAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(completionSchema, input, async (value, ctx) => {
    const updated = await setWorkoutCompletion(ctx.user.id, value.workoutId, value.completed);
    if (!updated) return fail("Workout not found");
    revalidateAll();
    return ok();
  });
}

export async function deleteWorkoutAction(workoutId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, workoutId, async (id, ctx) => {
    const deleted = await deleteWorkout(ctx.user.id, id);
    if (!deleted) return fail("Workout not found");
    revalidateAll();
    return ok();
  });
}

export async function addExerciseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withValidation(exerciseInputSchema, input, async (value, ctx) => {
    const id = await addExercise(ctx.user.id, value.workoutId, value.name, value.muscleGroup);
    if (!id) return fail("Workout not found");
    revalidateAll();
    return ok({ id });
  });
}

export async function deleteExerciseAction(exerciseId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, exerciseId, async (id, ctx) => {
    const deleted = await deleteExercise(ctx.user.id, id);
    if (!deleted) return fail("Exercise not found");
    revalidateAll();
    return ok();
  });
}

export async function addSetAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withValidation(setInputSchema, input, async (value, ctx) => {
    const id = await addSet(ctx.user.id, value.exerciseId, value);
    if (!id) return fail("Exercise not found");
    revalidateAll();
    return ok({ id });
  });
}

const setUpdateSchema = z.object({
  setId: uuidSchema,
  reps: z.number().int().min(0).max(1000).nullish(),
  weightKg: z.number().min(0).max(1000).nullish(),
  durationSeconds: z.number().int().min(0).max(86_400).nullish(),
  rpe: z.number().min(0).max(10).nullish(),
  completed: z.boolean().optional(),
});

export async function updateSetAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(setUpdateSchema, input, async (value, ctx) => {
    const { setId, ...patch } = value;
    const updated = await updateSet(ctx.user.id, setId, patch);
    if (!updated) return fail("Set not found");
    revalidateAll();
    return ok();
  });
}

export async function deleteSetAction(setId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, setId, async (id, ctx) => {
    const deleted = await deleteSet(ctx.user.id, id);
    if (!deleted) return fail("Set not found");
    revalidateAll();
    return ok();
  });
}

const templateSchema = z.object({ workoutId: uuidSchema, name: z.string().trim().min(1).max(80) });

export async function saveWorkoutTemplateAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(templateSchema, input, async (value, ctx) => {
    const id = await saveWorkoutAsTemplate(ctx.user.id, value.workoutId, value.name);
    if (!id) return fail("Workout not found");
    revalidateAll();
    return ok();
  });
}

export async function deleteWorkoutTemplateAction(
  templateId: string,
): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, templateId, async (id, ctx) => {
    const deleted = await deleteWorkoutTemplate(ctx.user.id, id);
    if (!deleted) return fail("Template not found");
    revalidateAll();
    return ok();
  });
}
