import type { GoalLike, GoalProgress } from "./goals";
import { formatValue } from "./format";

/**
 * The single "what should I do next?" suggestion shown on the dashboard and in
 * monitor mode.
 */
export interface NextAction {
  type: "goal" | "idle";
  goalId: string | null;
  label: string;
  detail: string | null;
}

export interface NextActionInput {
  goals: GoalLike[];
  progressById: Map<string, GoalProgress>;
}

/**
 * A strategy inspects the current state and either claims the slot or passes.
 * Strategies are tried in order, so the list *is* the priority policy — change
 * it (or add to it) without touching any call site.
 */
export type NextActionStrategy = (input: NextActionInput) => NextAction | null;

/** Not-yet-started boolean/count goals read as discrete actions: "do this". */
const discreteGoal: NextActionStrategy = ({ goals, progressById }) => {
  for (const goal of goals) {
    if (!isEligible(goal)) continue;
    if (goal.type !== "boolean" && goal.type !== "count") continue;
    const progress = progressById.get(goal.id);
    if (!progress || progress.status === "complete" || progress.trackingOnly) continue;
    return {
      type: "goal",
      goalId: goal.id,
      label: goal.name,
      detail:
        progress.target && progress.target > 1
          ? `${formatValue(progress.current)} of ${formatValue(progress.target)} done`
          : null,
    };
  }
  return null;
};

/** Otherwise nudge the numeric goal with the largest outstanding share. */
const largestGap: NextActionStrategy = ({ goals, progressById }) => {
  let best: { goal: GoalLike; progress: GoalProgress } | null = null;
  for (const goal of goals) {
    if (!isEligible(goal)) continue;
    const progress = progressById.get(goal.id);
    if (!progress || progress.trackingOnly || progress.status === "complete") continue;
    if (!best || progress.progress < best.progress.progress) best = { goal, progress };
  }
  if (!best) return null;
  const { goal, progress } = best;
  const remaining = formatValue(progress.remaining ?? 0);
  const unit = goal.unit ? `${remaining} ${goal.unit}` : remaining;
  return {
    type: "goal",
    goalId: goal.id,
    label: `${unit} ${goal.name.toLowerCase()} remaining`,
    detail: `${formatValue(progress.current)} / ${formatValue(progress.target ?? 0)}${
      goal.unit ? ` ${goal.unit}` : ""
    }`,
  };
};

const allClear: NextActionStrategy = ({ goals }) => ({
  type: "idle",
  goalId: null,
  label: goals.length === 0 ? "Add your first goal" : "All goals met",
  detail: goals.length === 0 ? "Goals drive the whole dashboard" : "Nothing outstanding today",
});

export const DEFAULT_STRATEGIES: NextActionStrategy[] = [discreteGoal, largestGap, allClear];

function isEligible(goal: GoalLike): boolean {
  return goal.active && goal.showInChecklist;
}

export function resolveNextAction(
  input: NextActionInput,
  strategies: NextActionStrategy[] = DEFAULT_STRATEGIES,
): NextAction {
  for (const strategy of strategies) {
    const result = strategy(input);
    if (result) return result;
  }
  return { type: "idle", goalId: null, label: "Nothing to do", detail: null };
}
