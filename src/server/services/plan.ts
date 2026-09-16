import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { routines, timeBlocks } from "@/db/schema";
import type { Routine, TimeBlock } from "@/db/schema";
import type { EntrySource } from "@/lib/domain";
import type { LocalDate } from "@/lib/date";
import { routineAppliesOn, sortBlocks, weekdayMask } from "@/lib/plan";
import type { RoutineInput, TimeBlockInput } from "@/lib/validation";

// --- Routines --------------------------------------------------------------

export async function listRoutines(userId: string, activeOnly = false): Promise<Routine[]> {
  const filters = [eq(routines.userId, userId)];
  if (activeOnly) filters.push(eq(routines.active, true));
  return db
    .select()
    .from(routines)
    .where(and(...filters))
    .orderBy(asc(routines.startTime), asc(routines.sortOrder));
}

export async function createRoutine(userId: string, input: RoutineInput): Promise<Routine> {
  const [created] = await db
    .insert(routines)
    .values({
      userId,
      label: input.label,
      kind: input.kind,
      area: input.area ?? null,
      startTime: input.startTime,
      endTime: input.endTime,
      weekdays: weekdayMask(input.weekdays),
    })
    .returning();
  return created;
}

export async function setRoutineActive(userId: string, routineId: string, active: boolean): Promise<boolean> {
  const [updated] = await db
    .update(routines)
    .set({ active })
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .returning({ id: routines.id });
  return Boolean(updated);
}

export async function deleteRoutine(userId: string, routineId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(routines)
    .where(and(eq(routines.id, routineId), eq(routines.userId, userId)))
    .returning({ id: routines.id });
  return Boolean(deleted);
}

// --- Blocks ----------------------------------------------------------------

export async function listBlocks(userId: string, date: LocalDate): Promise<TimeBlock[]> {
  const rows = await db
    .select()
    .from(timeBlocks)
    .where(and(eq(timeBlocks.userId, userId), eq(timeBlocks.localDate, date)));
  return sortBlocks(rows);
}

/**
 * Materialises the day's routines into blocks. Idempotent: a routine that
 * already has a block on that date is left alone, so re-planning after edits
 * only adds what is missing.
 */
export async function planDay(
  userId: string,
  date: LocalDate,
  source: EntrySource = "web",
): Promise<{ blocks: TimeBlock[]; added: number }> {
  const [active, existing] = await Promise.all([listRoutines(userId, true), listBlocks(userId, date)]);
  const due = active.filter((routine) => routineAppliesOn(routine.weekdays, date));
  const present = new Set(existing.map((block) => block.routineId).filter(Boolean));
  const missing = due.filter((routine) => !present.has(routine.id));

  if (missing.length > 0) {
    await db.insert(timeBlocks).values(
      missing.map((routine) => ({
        userId,
        localDate: date,
        startTime: routine.startTime,
        endTime: routine.endTime,
        label: routine.label,
        kind: routine.kind,
        area: routine.area,
        routineId: routine.id,
        source,
      })),
    );
  }
  return { blocks: await listBlocks(userId, date), added: missing.length };
}

export async function addBlock(
  userId: string,
  date: LocalDate,
  input: TimeBlockInput,
  source: EntrySource = "web",
): Promise<TimeBlock> {
  const [created] = await db
    .insert(timeBlocks)
    .values({
      userId,
      localDate: date,
      startTime: input.startTime,
      endTime: input.endTime,
      label: input.label,
      kind: input.kind,
      area: input.area ?? null,
      taskId: input.taskId ?? null,
      source,
    })
    .returning();
  return created;
}

export async function setBlockDone(userId: string, blockId: string, done: boolean): Promise<TimeBlock | null> {
  const [updated] = await db
    .update(timeBlocks)
    .set({ done })
    .where(and(eq(timeBlocks.id, blockId), eq(timeBlocks.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function deleteBlock(userId: string, blockId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(timeBlocks)
    .where(and(eq(timeBlocks.id, blockId), eq(timeBlocks.userId, userId)))
    .returning({ id: timeBlocks.id });
  return Boolean(deleted);
}

export async function deleteBlocks(userId: string, blockIds: string[]): Promise<void> {
  if (blockIds.length === 0) return;
  await db.delete(timeBlocks).where(and(eq(timeBlocks.userId, userId), inArray(timeBlocks.id, blockIds)));
}
