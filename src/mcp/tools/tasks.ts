import "server-only";
import { defineTool } from "../registry";
import { recordMutation } from "../audit";
import { ToolFailure } from "./write";
import { findOneByName } from "./match";
import * as schemas from "../schemas";
import {
  completeTask,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from "@/server/services/tasks";
import type { Task } from "@/db/schema";
import type { McpContext } from "../context";

function view(task: Task) {
  return {
    id: task.id,
    title: task.title,
    area: task.area,
    dueDate: task.dueDate,
    priority: task.priority,
    status: task.status,
    completedOn: task.completedOn,
    notes: task.notes,
  };
}

/** Resolves a task by id or by loose title match among open tasks (then all). */
async function resolveTask(ctx: McpContext, taskId?: string, title?: string): Promise<Task> {
  if (taskId) {
    const task = await getTask(ctx.userId, taskId);
    if (!task) throw new ToolFailure(`No task found with id ${taskId}.`);
    return task;
  }
  const open = await listTasks(ctx.userId, { status: "todo" });
  try {
    return findOneByName(open, title ?? "", (task) => task.title, "open task");
  } catch (error) {
    if (!(error instanceof ToolFailure) || !error.message.startsWith("No ")) throw error;
    const all = await listTasks(ctx.userId, { status: "all" });
    return findOneByName(all, title ?? "", (task) => task.title, "task");
  }
}

export const taskTools = [
  defineTool({
    name: "add_task",
    title: "Add task",
    kind: "write",
    input: schemas.addTaskInput,
    description:
      "Creates a to-do with an optional life area, due date (YYYY-MM-DD) and priority. Use for reminders and things to get done, not for logging what already happened.",
    async run(ctx, args) {
      const task = await createTask(ctx.userId, { ...args, priority: args.priority ?? "medium" }, ctx.source);
      const due = task.dueDate ? ` due ${task.dueDate}` : "";
      const summary = `Added task "${task.title}"${due}.`;
      await recordMutation(ctx.userId, "add_task", args, summary, ctx.source);
      return { summary, data: view(task) };
    },
  }),
  defineTool({
    name: "complete_task",
    title: "Complete task",
    kind: "write",
    input: schemas.completeTaskInput,
    description:
      "Marks a task done. Identify it by taskId or by (part of) its title; open tasks are matched first. Defaults to today as the completion day.",
    async run(ctx, args) {
      const task = await resolveTask(ctx, args.taskId, args.title);
      const done = await completeTask(ctx.userId, task.id, args.date ?? ctx.today);
      if (!done) throw new ToolFailure(`No task found with id ${task.id}.`);
      const summary = `Completed "${done.title}".`;
      await recordMutation(ctx.userId, "complete_task", args, summary, ctx.source);
      return { summary, data: view(done) };
    },
  }),
  defineTool({
    name: "update_task",
    title: "Update task",
    kind: "write",
    input: schemas.updateTaskInput,
    description:
      "Changes a task's title, area, due date, priority, status or notes. Identify it by taskId or with `match` (part of the current title). Only the fields you pass change.",
    async run(ctx, args) {
      const { taskId, match, ...patch } = args;
      const task = await resolveTask(ctx, taskId, match);
      const updated = await updateTask(ctx.userId, task.id, patch, ctx.today);
      if (!updated) throw new ToolFailure(`No task found with id ${task.id}.`);
      const changed = Object.keys(patch).filter((key) => patch[key as keyof typeof patch] !== undefined);
      const summary =
        changed.length === 0
          ? `No changes requested for "${updated.title}".`
          : `Updated ${changed.join(", ")} on "${updated.title}".`;
      await recordMutation(ctx.userId, "update_task", args, summary, ctx.source);
      return { summary, data: view(updated) };
    },
  }),
  defineTool({
    name: "list_tasks",
    title: "List tasks",
    kind: "read",
    input: schemas.listTasksInput,
    description:
      "Open tasks by default (due first, then priority), or done/all. Filter by area or by due date. Use this to answer 'what do I need to do' questions.",
    async run(ctx, args) {
      const rows = await listTasks(ctx.userId, {
        status: args.status ?? "todo",
        area: args.area ?? null,
        dueBefore: args.dueBefore ?? null,
        limit: 100,
      });
      const overdue = rows.filter(
        (task) => task.status === "todo" && task.dueDate !== null && task.dueDate < ctx.today,
      ).length;
      return {
        summary: `${rows.length} ${args.status ?? "open"} task(s)${overdue ? `, ${overdue} overdue` : ""}.`,
        data: { today: ctx.today, tasks: rows.map(view) },
      };
    },
  }),
  defineTool({
    name: "delete_task",
    title: "Delete task",
    kind: "destructive",
    input: schemas.deleteTaskInput,
    description:
      "Permanently deletes a task (by taskId or title). Prefer complete_task when the task was actually done. Confirm with the user first.",
    async describe(ctx, args) {
      const task = await resolveTask(ctx, args.taskId, args.title);
      return `Delete the task "${task.title}"? This cannot be undone.`;
    },
    async run(ctx, args) {
      const task = await resolveTask(ctx, args.taskId, args.title);
      await deleteTask(ctx.userId, task.id);
      const summary = `Deleted task "${task.title}".`;
      await recordMutation(ctx.userId, "delete_task", args, summary, ctx.source);
      return { summary, data: { id: task.id, title: task.title, deleted: true } };
    },
  }),
];
