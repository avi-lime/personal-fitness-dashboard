import { TaskManager } from "@/components/tasks/task-manager";
import { requireContext } from "@/server/auth";
import { listTasks } from "@/server/services/tasks";
import { toLocalDate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tasks · Life Dashboard" };

export default async function TasksPage() {
  const { user, timezone } = await requireContext();
  const tasks = await listTasks(user.id, { status: "all" });
  return <TaskManager tasks={tasks} today={toLocalDate(new Date(), timezone)} />;
}
