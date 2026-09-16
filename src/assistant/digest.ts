import "server-only";
import type { McpContext } from "@/mcp/context";
import { listGoals } from "@/server/services/goals";
import { listTasks } from "@/server/services/tasks";
import { getRunningTimer } from "@/server/services/time";
import { listApplications } from "@/server/services/career";
import { listBlocks } from "@/server/services/plan";
import { listAccounts, listBills } from "@/server/services/money";
import { AREA_LABELS } from "@/lib/domain";
import { formatValue } from "@/lib/format";

/**
 * A compact, name-first summary of the user's current state, injected into the
 * system prompt so "archive the water goal" resolves to an id in one call
 * instead of a read round trip. Kept small: names and a few numbers.
 */
export async function buildDigest(ctx: McpContext): Promise<string> {
  const [goals, openTasks, running, apps, blocks, accounts, pendingBills] = await Promise.all([
    listGoals(ctx.userId),
    listTasks(ctx.userId, { status: "todo", limit: 30 }),
    getRunningTimer(ctx.userId),
    listApplications(ctx.userId),
    listBlocks(ctx.userId, ctx.today),
    listAccounts(ctx.userId),
    listBills(ctx.userId, "pending"),
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

  if (apps.length > 0) {
    lines.push("Job applications (company · role · stage · next step):");
    for (const app of apps.slice(0, 20)) {
      const next = app.nextStep ? `${app.nextStep}${app.nextStepDate ? ` by ${app.nextStepDate}` : ""}` : "—";
      lines.push(`- ${app.company} · ${app.role} · ${app.stage} · ${next}`);
    }
  }

  lines.push(
    blocks.length === 0
      ? "Today's plan: nothing planned yet."
      : `Today's plan: ${blocks.map((b) => `${b.startTime}–${b.endTime} ${b.label}${b.done ? " ✓" : ""}`).join("; ")}.`,
  );

  if (accounts.length > 0) {
    lines.push(`Money accounts: ${accounts.map((a) => `${a.name} (${a.kind.replace("_", " ")}, balance ${formatValue(a.balance, 2)})`).join("; ")}.`);
  } else {
    lines.push("Money accounts: none (expenses can still be logged without one).");
  }
  if (pendingBills.length > 0) {
    lines.push(`Pending bills: ${pendingBills.slice(0, 10).map((b) => `${b.name} ${formatValue(b.amount, 2)} due ${b.dueDate}`).join("; ")}.`);
  }

  return lines.join("\n");
}
