import "server-only";
import type { McpContext } from "@/mcp/context";
import { listGoals } from "@/server/services/goals";
import { formatValue } from "@/lib/format";

/**
 * A compact, name-first summary of the user's current state, injected into the
 * system prompt so "archive the water goal" resolves to an id in one call
 * instead of a read round trip. Kept small: names and a few numbers.
 */
export async function buildDigest(ctx: McpContext): Promise<string> {
  const goals = await listGoals(ctx.userId);
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

  return lines.join("\n");
}
