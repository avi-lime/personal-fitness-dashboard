import "server-only";
import type { McpContext } from "@/mcp/context";
import { listGoals } from "@/server/services/goals";
import { listTasks } from "@/server/services/tasks";
import { getRunningTimer } from "@/server/services/time";
import { AREA_LABELS } from "@/lib/domain";
import { formatValue } from "@/lib/format";

/**
 * A compact, name-first summary of the user's current state, injected into the
 * system prompt so "archive the water goal" resolves to an id in one call
 * instead of a read round trip. Kept small: names and a few numbers.
 */
export async function buildDigest(ctx: McpContext): Promise<string> {
  const [goals, openTasks, running] = await Promise.all([
    listGoals(ctx.userId),
    listTasks(ctx.userId, { status: "todo", limit: 30 }),
    getRunningTimer(ctx.userId),
  ]);
  const lines: string[] = [];

  if (goals.length === 0) {
    lines.push("Goals: none yet.");
  } else {
    lines.push("Goals (name · id · target):");
    for (const goal of goals) {
      const target =
        goal.targetValue !== null
          ? `${formatValue(goal.targetValue)}${goal.unit ? ` ${goal.unit}` : ""} per ${goal.period.replace("_", " ")}`
          : "no target";
      const state = goal.active ? "" : " (paused)";
      lines.push(`- ${goal.name}${state} · ${goal.id} · ${target}`);
    }
  }

  if (openTasks.length === 0) {
    lines.push("Open tasks: none.");
  } else {
    lines.push("Open tasks (title · due · priority):");
    for (const task of openTasks) {
      const overdue = task.dueDate && task.dueDate < ctx.today ? " OVERDUE" : "";
      lines.push(`- ${task.title} · ${task.dueDate ?? "no date"}${overdue} · ${task.priority}`);
    }
  }

  lines.push(
    running
      ? `Running timer: ${AREA_LABELS[running.category]}${running.label ? ` (${running.label})` : ""} since ${running.startAt.toISOString()}.`
      : "Running timer: none.",
  );

  return lines.join("\n");
}
