import { DietPlanManager } from "@/components/diet/diet-plan-manager";
import { requireContext } from "@/server/auth";
import { getDietPlan, listDietPlans } from "@/server/services/diet";
import { listGoals, toGoalLike } from "@/server/services/goals";
import type { MetricKey } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diet · Life Dashboard" };

export default async function DietPage() {
  const { user } = await requireContext();

  const [view, plans, goals] = await Promise.all([
    // Disabled meals and options are loaded so they can be brought back.
    getDietPlan(user.id, { includeInactive: true }),
    listDietPlans(user.id),
    listGoals(user.id, false),
  ]);

  const target = (metric: MetricKey): number | null =>
    goals.map(toGoalLike).find((goal) => goal.metricKey === metric && goal.period === "daily")
      ?.targetValue ?? null;

  return (
    <DietPlanManager
      plan={view?.plan ?? null}
      meals={view?.meals ?? []}
      plans={plans.map((entry) => ({ id: entry.id, name: entry.name, active: entry.active }))}
      goalTargets={{ calories: target("calories"), protein: target("protein") }}
    />
  );
}
