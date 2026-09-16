import { DayPlan } from "@/components/plan/day-plan";
import { requireContext } from "@/server/auth";
import { listBlocks, listRoutines } from "@/server/services/plan";
import { listTasks } from "@/server/services/tasks";
import { isLocalDate, toLocalDate, toLocalTime } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan · Life Dashboard" };

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const { user, timezone } = await requireContext();
  const params = await searchParams;
  const requested = Array.isArray(params.date) ? params.date[0] : params.date;
  const today = toLocalDate(new Date(), timezone);
  const date = typeof requested === "string" && isLocalDate(requested) ? requested : today;

  const [blocks, routines, tasks] = await Promise.all([
    listBlocks(user.id, date),
    listRoutines(user.id),
    listTasks(user.id, { status: "todo", dueBefore: date, limit: 30 }),
  ]);

  return (
    <DayPlan
      date={date}
      today={today}
      timezone={timezone}
      now={toLocalTime(new Date(), timezone)}
      blocks={blocks}
      routines={routines}
      tasksDue={tasks
        .filter((task) => task.dueDate !== null)
        .map((task) => ({ id: task.id, title: task.title, dueDate: task.dueDate }))}
    />
  );
}
