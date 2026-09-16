import "server-only";
import { and, asc, desc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import type { Task } from "@/db/schema";
import type { AreaKey, EntrySource, TaskStatus } from "@/lib/domain";
import type { LocalDate } from "@/lib/date";
import type { TaskInput, TaskUpdate } from "@/lib/validation";

export interface ListTasksOptions {
  status?: TaskStatus | "all";
  area?: AreaKey | null;
  dueBefore?: LocalDate | null;
  limit?: number;
}

/** Open tasks first by due date (undated last) then priority; done tasks newest first. */
export async function listTasks(userId: string, options: ListTasksOptions = {}): Promise<Task[]> {
  const status = options.status ?? "todo";
  const filters = [eq(tasks.userId, userId)];
  if (status !== "all") filters.push(eq(tasks.status, status));
  if (options.area) filters.push(eq(tasks.area, options.area));
  if (options.dueBefore) {
    filters.push(or(lte(tasks.dueDate, options.dueBefore), isNull(tasks.dueDate))!);
  }

  return db
    .select()
    .from(tasks)
    .where(and(...filters))
    .orderBy(
      asc(tasks.status),
      sql`${tasks.dueDate} asc nulls last`,
      sql`case ${tasks.priority} when 'high' then 0 when 'medium' then 1 else 2 end`,
      desc(tasks.completedAt),
      asc(tasks.createdAt),
    )
    .limit(options.limit ?? 200);
}

export async function getTask(userId: string, taskId: string): Promise<Task | null> {
  const row = await db.query.tasks.findFirst({
    where: and(eq(tasks.id, taskId), eq(tasks.userId, userId)),
  });
  return row ?? null;
}

export async function createTask(
  userId: string,
  input: TaskInput,
  source: EntrySource = "web",
): Promise<Task> {
  const [created] = await db
    .insert(tasks)
    .values({
      userId,
      title: input.title,
      area: input.area ?? null,
      dueDate: input.dueDate ?? null,
      priority: input.priority,
      notes: input.notes ?? null,
      source,
    })
    .returning();
  return created;
}

export async function updateTask(
  userId: string,
  taskId: string,
  patch: TaskUpdate,
  today: LocalDate,
): Promise<Task | null> {
  const changes: Partial<typeof tasks.$inferInsert> = {};
  if (patch.title !== undefined) changes.title = patch.title;
  if (patch.area !== undefined) changes.area = patch.area ?? null;
  if (patch.dueDate !== undefined) changes.dueDate = patch.dueDate ?? null;
  if (patch.priority !== undefined) changes.priority = patch.priority;
  if (patch.notes !== undefined) changes.notes = patch.notes ?? null;
  if (patch.status !== undefined) {
    changes.status = patch.status;
    changes.completedAt = patch.status === "done" ? new Date() : null;
    changes.completedOn = patch.status === "done" ? today : null;
  }
  if (Object.keys(changes).length === 0) return getTask(userId, taskId);

  const [updated] = await db
    .update(tasks)
    .set(changes)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning();
  return updated ?? null;
}

/** Marks a task done on a given day (defaults to today). Idempotent. */
export async function completeTask(
  userId: string,
  taskId: string,
  date: LocalDate,
): Promise<Task | null> {
  const [updated] = await db
    .update(tasks)
    .set({ status: "done", completedAt: new Date(), completedOn: date })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function reopenTask(userId: string, taskId: string): Promise<Task | null> {
  const [updated] = await db
    .update(tasks)
    .set({ status: "todo", completedAt: null, completedOn: null })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function deleteTask(userId: string, taskId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .returning({ id: tasks.id });
  return Boolean(deleted);
}

export interface TaskCounts {
  open: number;
  overdue: number;
  dueToday: number;
}

export function countTasks(rows: Task[], today: LocalDate): TaskCounts {
  const open = rows.filter((task) => task.status === "todo");
  return {
    open: open.length,
    overdue: open.filter((task) => task.dueDate !== null && task.dueDate < today).length,
    dueToday: open.filter((task) => task.dueDate === today).length,
  };
}
