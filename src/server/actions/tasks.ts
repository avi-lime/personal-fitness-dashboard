"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { taskInputSchema, taskUpdateSchema, uuidSchema } from "@/lib/validation";
import { toLocalDate } from "@/lib/date";
import {
  completeTask,
  createTask,
  deleteTask,
  reopenTask,
  updateTask,
} from "@/server/services/tasks";
import { revalidateAll, withValidation } from "./helpers";

export async function createTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withValidation(taskInputSchema, input, async (value, ctx) => {
    const task = await createTask(ctx.user.id, value);
    revalidateAll();
    return ok({ id: task.id });
  });
}

const updateSchema = z.object({ taskId: uuidSchema, patch: taskUpdateSchema });

export async function updateTaskAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(updateSchema, input, async (value, ctx) => {
    const today = toLocalDate(new Date(), ctx.timezone);
    const updated = await updateTask(ctx.user.id, value.taskId, value.patch, today);
    if (!updated) return fail("Task not found");
    revalidateAll();
    return ok();
  });
}

const completionSchema = z.object({ taskId: uuidSchema, done: z.boolean() });

export async function setTaskDoneAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(completionSchema, input, async (value, ctx) => {
    const updated = value.done
      ? await completeTask(ctx.user.id, value.taskId, toLocalDate(new Date(), ctx.timezone))
      : await reopenTask(ctx.user.id, value.taskId);
    if (!updated) return fail("Task not found");
    revalidateAll();
    return ok();
  });
}

export async function deleteTaskAction(taskId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, taskId, async (id, ctx) => {
    const deleted = await deleteTask(ctx.user.id, id);
    if (!deleted) return fail("Task not found");
    revalidateAll();
    return ok();
  });
}
