import { GoalManager } from "@/components/goals/goal-manager";
import { requireContext } from "@/server/auth";
import { listGoals, toGoalLike } from "@/server/services/goals";
import { sortGoals } from "@/lib/goals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Goals · Life Dashboard" };

export default async function GoalsPage() {
  const { user } = await requireContext();
  const goals = sortGoals((await listGoals(user.id)).map(toGoalLike));
  return <GoalManager goals={goals} />;
}
