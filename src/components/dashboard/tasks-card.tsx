"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/common/use-action";
import { setTaskDoneAction } from "@/server/actions/tasks";
import { formatShortDate, type LocalDate } from "@/lib/date";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/utils";

export function TasksCard({ tasks, today, overdue }: { tasks: Task[]; today: LocalDate; overdue: number }) {
  const { pending, run } = useAction();
  const shown = tasks.slice(0, 6);

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">
          Tasks
          {overdue > 0 ? <span className="ml-2 text-xs font-normal text-brand">{overdue} overdue</span> : null}
        </h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks">{tasks.length > shown.length ? `All ${tasks.length}` : "Open"}</Link>
        </Button>
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing open. Add one with &ldquo;add task …&rdquo;.</p>
      ) : (
        <ul className="divide-y">
          {shown.map((task) => {
            const late = task.dueDate !== null && task.dueDate < today;
            return (
              <li key={task.id} className="flex items-center gap-3 py-1.5">
                <input
                  type="checkbox"
                  disabled={pending}
                  onChange={() => run(() => setTaskDoneAction({ taskId: task.id, done: true }), { success: "Task completed" })}
                  aria-label={`Mark "${task.title}" done`}
                  className="size-4 accent-foreground"
                />
                <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                {task.dueDate ? (
                  <span className={cn("tabular text-xs", late ? "text-brand" : "text-muted-foreground")}>
                    {task.dueDate === today ? "today" : formatShortDate(task.dueDate)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
