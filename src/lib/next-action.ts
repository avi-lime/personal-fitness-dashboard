import type { GoalLike, GoalProgress } from "./goals";
import { formatMoney, formatValue } from "./format";
import { addDays, type LocalDate } from "./date";
import { minutesOf } from "./plan";

/**
 * The single "what should I do next?" suggestion shown on the dashboard and in
 * monitor mode.
 */
export interface NextAction {
  type: "goal" | "task" | "bill" | "block" | "application" | "idle";
  goalId: string | null;
  label: string;
  detail: string | null;
  /** Where acting on it happens. */
  href?: string;
}

export interface NextActionInput {
  goals: GoalLike[];
  progressById: Map<string, GoalProgress>;
  today?: LocalDate;
  /** HH:MM in the user's timezone. */
  nowTime?: string;
  tasks?: Array<{ id: string; title: string; dueDate: string | null; priority: string }>;
  bills?: Array<{ id: string; name: string; amount: number; dueDate: string }>;
  currency?: string;
  blocks?: Array<{ id: string; label: string; startTime: string; endTime: string; done: boolean }>;
  applications?: Array<{
    id: string;
    company: string;
    role: string;
    nextStep: string | null;
    nextStepDate: string | null;
  }>;
}

/**
 * A strategy inspects the current state and either claims the slot or passes.
 * Strategies are tried in order, so the list *is* the priority policy — change
 * it (or add to it) without touching any call site.
 */
export type NextActionStrategy = (input: NextActionInput) => NextAction | null;

/** A planned block is happening right now and is not done yet. */
const currentBlock: NextActionStrategy = ({ blocks, nowTime }) => {
  if (!blocks || !nowTime) return null;
  const block = blocks.find((b) => !b.done && b.startTime <= nowTime && nowTime < b.endTime);
  if (!block) return null;
  return {
    type: "block",
    goalId: null,
    label: block.label,
    detail: `Now · until ${block.endTime}`,
    href: "/plan",
  };
};

const overdueTask: NextActionStrategy = ({ tasks, today }) => {
  if (!tasks || !today) return null;
  const overdue = tasks
    .filter((task) => task.dueDate !== null && task.dueDate < today)
    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))[0];
  if (!overdue) return null;
  return {
    type: "task",
    goalId: null,
    label: overdue.title,
    detail: `Overdue since ${overdue.dueDate}`,
    href: "/tasks",
  };
};

const billDueSoon: NextActionStrategy = ({ bills, today, currency }) => {
  if (!bills || !today) return null;
  const horizon = addDays(today, 2);
  const due = bills.filter((bill) => bill.dueDate <= horizon).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  if (!due) return null;
  const when = due.dueDate < today ? "overdue" : due.dueDate === today ? "due today" : `due ${due.dueDate}`;
  return {
    type: "bill",
    goalId: null,
    label: `Pay ${due.name}`,
    detail: `${formatMoney(due.amount, currency ?? "INR")} · ${when}`,
    href: "/money",
  };
};

const applicationStepDue: NextActionStrategy = ({ applications, today }) => {
  if (!applications || !today) return null;
  const due = applications
    .filter((app) => app.nextStep && app.nextStepDate !== null && app.nextStepDate <= today)
    .sort((a, b) => (a.nextStepDate ?? "").localeCompare(b.nextStepDate ?? ""))[0];
  if (!due) return null;
  return {
    type: "application",
    goalId: null,
    label: due.nextStep ?? "Next step",
    detail: `${due.company} · ${due.role}`,
    href: "/career",
  };
};

/** Something planned starts within the hour. */
const upcomingBlock: NextActionStrategy = ({ blocks, nowTime }) => {
  if (!blocks || !nowTime) return null;
  const soon = blocks
    .filter((b) => !b.done && b.startTime > nowTime && minutesOf(b.startTime) - minutesOf(nowTime) <= 60)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  if (!soon) return null;
  return {
    type: "block",
    goalId: null,
    label: soon.label,
    detail: `Up next at ${soon.startTime}`,
    href: "/plan",
  };
};

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

/** Time-bound things first, then goals. */
export const DEFAULT_STRATEGIES: NextActionStrategy[] = [
  currentBlock,
  overdueTask,
  billDueSoon,
  applicationStepDue,
  upcomingBlock,
  discreteGoal,
  largestGap,
  allClear,
];

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
