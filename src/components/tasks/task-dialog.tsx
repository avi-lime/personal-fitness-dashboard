"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { AreaSelect } from "@/components/common/area-select";
import { useAction } from "@/components/common/use-action";
import { useEstimate } from "@/components/assistant/use-estimate";
import { EstimateButton } from "@/components/assistant/estimate-button";
import { createTaskAction, updateTaskAction } from "@/server/actions/tasks";
import { TASK_PRIORITIES, type AreaKey, type TaskPriority } from "@/lib/domain";
import type { Task } from "@/db/schema";

export function TaskDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Add task"}</DialogTitle>
          <DialogDescription>Only the title is required.</DialogDescription>
        </DialogHeader>
        {open ? (
          <TaskForm key={task?.id ?? "new"} task={task} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TaskForm({ task, onDone }: { task?: Task | null; onDone: () => void }) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [area, setArea] = useState<AreaKey | null>(task?.area ?? null);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [reason, setReason] = useState("");
  const { pending, run } = useAction();
  const estimator = useEstimate();

  const suggestFields = async () => {
    const result = await estimator.estimate("task_fields", { title: title.trim() });
    if (!result) return;
    setTitle(result.title);
    setArea(result.area);
    setPriority(result.priority);
    if (result.dueDate) setDueDate(result.dueDate);
    setReason(result.reason);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = {
          title: title.trim(),
          area,
          dueDate: dueDate || null,
          priority,
          notes: notes.trim() || null,
        };
        run(
          () =>
            task
              ? updateTaskAction({ taskId: task.id, patch: payload })
              : createTaskAction(payload),
          { success: task ? "Task updated" : "Task added", onSuccess: onDone },
        );
      }}
    >
      <Field id="task-title" label="Title">
        <div className="flex gap-2">
          <Input
            id="task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            autoFocus
            placeholder="Update resume by Friday"
          />
          <EstimateButton
            onClick={() => void suggestFields()}
            pending={estimator.pending}
            disabled={title.trim() === ""}
            label="Fill details"
            title="Let the assistant pick area, priority and due date from the title"
          />
        </div>
        {reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="task-area" label="Area">
          <AreaSelect id="task-area" value={area} onChange={setArea} allowNone />
        </Field>
        <Field id="task-due" label="Due">
          <Input
            id="task-due"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </Field>
        <Field id="task-priority" label="Priority">
          <Select value={priority} onValueChange={(value) => setPriority(value as TaskPriority)}>
            <SelectTrigger id="task-priority" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((level) => (
                <SelectItem key={level} value={level} className="capitalize">
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field id="task-notes" label="Notes">
        <Textarea
          id="task-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={2}
          placeholder="optional"
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || title.trim() === ""}>
          {task ? "Save" : "Add task"}
        </Button>
      </DialogFooter>
    </form>
  );
}
