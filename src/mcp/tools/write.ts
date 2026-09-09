import "server-only";
import { z } from "zod";
import type { McpContext } from "@/mcp/context";
import { recordMutation } from "@/mcp/audit";
import { logFood } from "@/server/services/food";
import { logWater } from "@/server/services/water";
import { logSleep, logWeight } from "@/server/services/body";
import { addNote } from "@/server/services/notes";
import { createWorkout, setWorkoutCompletion } from "@/server/services/workouts";
import {
  archiveGoal,
  createGoal,
  getGoal,
  recordGoalEntry,
  updateGoal,
} from "@/server/services/goals";
import { formatValue } from "@/lib/format";
import type {
  addGoalInput,
  addNoteInput,
  completeGoalInput,
  logFoodInput,
  logSleepInput,
  logWaterInput,
  logWeightInput,
  logWorkoutInput,
  removeGoalInput,
  updateGoalInput,
} from "@/mcp/schemas";

/**
 * Write tools. Each performs exactly one narrow mutation, writes an audit row
 * and returns what was stored so the caller can read the result back.
 */

export class ToolFailure extends Error {}

export async function logFoodTool(ctx: McpContext, args: z.infer<typeof logFoodInput>) {
  const entry = await logFood(
    ctx.userId,
    ctx.timezone,
    {
      name: args.foodName,
      calories: args.calories,
      proteinG: args.protein ?? null,
      carbsG: args.carbs ?? null,
      fatG: args.fat ?? null,
      quantity: args.quantity ?? 1,
      unit: args.unit ?? "serving",
      mealType: args.mealType ?? "other",
      notes: args.notes ?? null,
      occurredAt: args.timestamp ?? null,
    },
    "mcp",
  );

  const summary = `Logged ${formatValue(entry.calories)} kcal — ${entry.name} (${entry.mealType}) on ${entry.localDate}.`;
  await recordMutation(ctx.userId, "log_food", args, summary);
  return {
    summary,
    data: {
      id: entry.id,
      date: entry.localDate,
      name: entry.name,
      calories: entry.calories,
      proteinG: entry.proteinG,
      carbsG: entry.carbsG,
      fatG: entry.fatG,
      mealType: entry.mealType,
      loggedAt: entry.occurredAt.toISOString(),
    },
  };
}

export async function logWaterTool(ctx: McpContext, args: z.infer<typeof logWaterInput>) {
  const entry = await logWater(
    ctx.userId,
    ctx.timezone,
    args.milliliters,
    args.timestamp ?? null,
    "mcp",
  );
  const summary = `Logged ${entry.milliliters} ml of water on ${entry.localDate}.`;
  await recordMutation(ctx.userId, "log_water", args, summary);
  return {
    summary,
    data: {
      id: entry.id,
      date: entry.localDate,
      milliliters: entry.milliliters,
      loggedAt: entry.occurredAt.toISOString(),
    },
  };
}

export async function logWeightTool(ctx: McpContext, args: z.infer<typeof logWeightInput>) {
  const entry = await logWeight(
    ctx.userId,
    ctx.timezone,
    args.kilograms,
    args.timestamp ?? null,
    args.note ?? null,
    "mcp",
  );
  const summary = `Recorded ${formatValue(entry.weightKg, 2)} kg on ${entry.localDate}.`;
  await recordMutation(ctx.userId, "log_weight", args, summary);
  return {
    summary,
    data: {
      id: entry.id,
      date: entry.localDate,
      weightKg: entry.weightKg,
      note: entry.note,
      recordedAt: entry.occurredAt.toISOString(),
    },
  };
}

export async function logSleepTool(ctx: McpContext, args: z.infer<typeof logSleepInput>) {
  const entry = await logSleep(
    ctx.userId,
    ctx.timezone,
    {
      startTime: args.startTime,
      endTime: args.endTime,
      quality: args.quality ?? null,
      note: args.note ?? null,
    },
    "mcp",
  );
  const hours = (entry.endAt.getTime() - entry.startAt.getTime()) / 3_600_000;
  const summary = `Logged ${formatValue(hours, 2)} h of sleep for ${entry.localDate}.`;
  await recordMutation(ctx.userId, "log_sleep", args, summary);
  return {
    summary,
    data: {
      id: entry.id,
      date: entry.localDate,
      startAt: entry.startAt.toISOString(),
      endAt: entry.endAt.toISOString(),
      hours: Math.round(hours * 100) / 100,
      quality: entry.quality,
    },
  };
}

export async function logWorkoutTool(ctx: McpContext, args: z.infer<typeof logWorkoutInput>) {
  const workout = await createWorkout(
    ctx.userId,
    ctx.timezone,
    { name: args.workoutName, date: args.date ?? null, notes: args.notes ?? null },
    "mcp",
  );
  const completed = args.completed ?? true;
  if (completed) await setWorkoutCompletion(ctx.userId, workout.id, true);

  const summary = `Created workout "${workout.name}" on ${workout.date}${
    completed ? " and marked it complete" : ""
  }.`;
  await recordMutation(ctx.userId, "log_workout", args, summary);
  return {
    summary,
    data: { id: workout.id, name: workout.name, date: workout.date, completed },
  };
}

export async function addGoalTool(ctx: McpContext, args: z.infer<typeof addGoalInput>) {
  const goal = await createGoal(ctx.userId, {
    name: args.name,
    description: args.description ?? null,
    type: args.type,
    unit: args.unit ?? null,
    targetValue: args.targetValue ?? null,
    period: args.period,
    metricKey: args.metricKey ?? null,
    visibleOnDashboard: args.visibleOnDashboard ?? true,
    showInChecklist: args.showInChecklist ?? true,
  });

  const summary = `Created goal "${goal.name}"${
    goal.targetValue !== null ? ` with a target of ${formatValue(goal.targetValue)}${goal.unit ? ` ${goal.unit}` : ""} per ${goal.period}` : " with no target"
  }.`;
  await recordMutation(ctx.userId, "add_goal", args, summary);
  return {
    summary,
    data: {
      id: goal.id,
      name: goal.name,
      type: goal.type,
      unit: goal.unit,
      targetValue: goal.targetValue,
      period: goal.period,
      metricKey: goal.metricKey,
    },
  };
}

export async function updateGoalTool(ctx: McpContext, args: z.infer<typeof updateGoalInput>) {
  const { goalId, ...patch } = args;
  const updated = await updateGoal(ctx.userId, goalId, patch);
  if (!updated) throw new ToolFailure(`No goal found with id ${goalId}.`);

  const changed = Object.keys(patch);
  const summary =
    changed.length === 0
      ? `No changes requested for "${updated.name}".`
      : `Updated ${changed.join(", ")} on goal "${updated.name}".`;
  await recordMutation(ctx.userId, "update_goal", args, summary);
  return {
    summary,
    data: {
      id: updated.id,
      name: updated.name,
      type: updated.type,
      unit: updated.unit,
      targetValue: updated.targetValue,
      period: updated.period,
      metricKey: updated.metricKey,
      active: updated.active,
      visibleOnDashboard: updated.visibleOnDashboard,
      showInChecklist: updated.showInChecklist,
    },
  };
}

export async function removeGoalTool(ctx: McpContext, args: z.infer<typeof removeGoalInput>) {
  const goal = await getGoal(ctx.userId, args.goalId);
  if (!goal) throw new ToolFailure(`No goal found with id ${args.goalId}.`);
  await archiveGoal(ctx.userId, args.goalId);

  const summary = `Archived goal "${goal.name}". Its past entries are kept.`;
  await recordMutation(ctx.userId, "remove_goal", args, summary);
  return { summary, data: { id: goal.id, name: goal.name, archived: true } };
}

export async function completeGoalTool(ctx: McpContext, args: z.infer<typeof completeGoalInput>) {
  const goal = await getGoal(ctx.userId, args.goalId);
  if (!goal) throw new ToolFailure(`No goal found with id ${args.goalId}.`);
  if (goal.metricKey) {
    throw new ToolFailure(
      `"${goal.name}" is tracked automatically from ${goal.metricKey}. Log the underlying entry instead of completing the goal directly.`,
    );
  }

  const result = await recordGoalEntry(ctx.userId, args.goalId, {
    date: args.date ?? null,
    value: args.value ?? null,
    timezone: ctx.timezone,
    source: "mcp",
  });
  if (!result) throw new ToolFailure(`No goal found with id ${args.goalId}.`);

  const summary = `Recorded ${formatValue(result.value)}${goal.unit ? ` ${goal.unit}` : ""} for "${goal.name}" on ${result.date}.`;
  await recordMutation(ctx.userId, "complete_goal", args, summary);
  return {
    summary,
    data: { goalId: goal.id, name: goal.name, date: result.date, value: result.value },
  };
}

export async function addNoteTool(ctx: McpContext, args: z.infer<typeof addNoteInput>) {
  const note = await addNote(ctx.userId, ctx.timezone, args.note, args.date ?? null, "mcp");
  const summary = `Added a note for ${note.localDate}.`;
  await recordMutation(ctx.userId, "add_note", args, summary);
  return { summary, data: { id: note.id, date: note.localDate, body: note.body } };
}
