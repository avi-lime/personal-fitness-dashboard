"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { TaskDialog } from "./task-dialog";
import { deleteTaskAction, setTaskDoneAction } from "@/server/actions/tasks";
import { AREA_LABELS } from "@/lib/domain";
import { formatShortDate, type LocalDate } from "@/lib/date";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/utils";

interface Group {
  key: string;
  label: string;
  tasks: Task[];
}

function groupTasks(tasks: Task[], today: LocalDate): Group[] {
  const open = tasks.filter((task) => task.status === "todo");
  const done = tasks.filter((task) => task.status === "done").slice(0, 20);
  return [
    { key: "overdue", label: "Overdue", tasks: open.filter((t) => t.dueDate !== null && t.dueDate < today) },
    { key: "today", label: "Today", tasks: open.filter((t) => t.dueDate === today) },
    { key: "upcoming", label: "Upcoming", tasks: open.filter((t) => t.dueDate !== null && t.dueDate > today) },
    { key: "someday", label: "No date", tasks: open.filter((t) => t.dueDate === null) },
    { key: "done", label: "Done", tasks: done },
  ].filter((group) => group.tasks.length > 0);
}

export function TaskManager({ tasks, today }: { tasks: Task[]; today: LocalDate }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const { pending, run } = useAction();
  const groups = groupTasks(tasks, today);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Things to get done. Completed tasks count towards &ldquo;tasks completed&rdquo; goals.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden /> Add task
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description='Add one here, or say "add task update resume by Friday".'
          action={<Button size="sm" onClick={() => setCreating(true)}>Add task</Button>}
        />
      ) : (
        groups.map((group) => (
          <section key={group.key} aria-labelledby={`tasks-${group.key}`}>
            <h2
              id={`tasks-${group.key}`}
              className={cn(
                "mb-2 text-xs font-medium tracking-wide uppercase",
                group.key === "overdue" ? "text-brand" : "text-muted-foreground",
              )}
            >
              {group.label} · {group.tasks.length}
            </h2>
            <Card className="gap-0 p-0">
              <ul className="divide-y">
                {group.tasks.map((task) => {
                  const done = task.status === "done";
                  return (
                    <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={done}
                        disabled={pending}
                        onChange={(event) =>
                          run(() => setTaskDoneAction({ taskId: task.id, done: event.target.checked }), {
                            success: event.target.checked ? "Task completed" : "Task reopened",
                          })
                        }
                        aria-label={`Mark "${task.title}" ${done ? "not done" : "done"}`}
                        className="size-4 shrink-0 accent-foreground"
                      />
                      <div className="min-w-0 flex-1">
                        <p className={cn("flex items-center gap-2 text-sm", done && "text-muted-foreground line-through")}>
                          {task.priority === "high" && !done ? (
                            <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-label="High priority" />
                          ) : null}
                          <span className="truncate">{task.title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.area ? AREA_LABELS[task.area] : null}
                          {task.area && task.dueDate ? " · " : null}
                          {task.dueDate ? (done ? `done ${task.completedOn ?? ""}` : `due ${formatShortDate(task.dueDate)}`) : null}
                          {task.notes ? ` · ${task.notes}` : null}
                        </p>
                      </div>
                      {task.priority !== "medium" && !done ? (
                        <Badge variant="outline" className="hidden capitalize sm:inline-flex">
                          {task.priority}
                        </Badge>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${task.title}`}
                        onClick={() => setEditing(task)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={pending}
                        aria-label={`Delete ${task.title}`}
                        onClick={() => {
                          if (window.confirm(`Delete "${task.title}"?`)) {
                            run(() => deleteTaskAction(task.id), { success: "Task deleted" });
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ))
      )}

      <TaskDialog open={creating} onOpenChange={setCreating} />
      <TaskDialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} task={editing} />
    </div>
  );
}
