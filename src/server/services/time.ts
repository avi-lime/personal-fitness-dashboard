import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { timeEntries } from "@/db/schema";
import type { TimeEntry } from "@/db/schema";
import type { AreaKey, EntrySource } from "@/lib/domain";
import { toLocalDate, type LocalDate } from "@/lib/date";
import type { TimeEntryInput } from "@/lib/validation";

function minutesBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
}

export async function getRunningTimer(userId: string): Promise<TimeEntry | null> {
  const row = await db.query.timeEntries.findFirst({
    where: and(eq(timeEntries.userId, userId), isNull(timeEntries.endAt)),
    orderBy: [desc(timeEntries.startAt)],
  });
  return row ?? null;
}

/** Stops the running timer, if any, and returns it with its duration filled in. */
export async function stopTimer(userId: string, notes?: string | null): Promise<TimeEntry | null> {
  const running = await getRunningTimer(userId);
  if (!running) return null;
  const endAt = new Date();
  const [stopped] = await db
    .update(timeEntries)
    .set({
      endAt,
      durationMinutes: minutesBetween(running.startAt, endAt),
      ...(notes ? { notes } : {}),
    })
    .where(eq(timeEntries.id, running.id))
    .returning();
  return stopped;
}

/**
 * Starts a timer. Only one runs at a time: an existing one is stopped first
 * and returned so the caller can say so.
 */
export async function startTimer(
  userId: string,
  timezone: string,
  category: AreaKey,
  label?: string | null,
  source: EntrySource = "web",
): Promise<{ started: TimeEntry; stopped: TimeEntry | null }> {
  const stopped = await stopTimer(userId);
  const startAt = new Date();
  const [started] = await db
    .insert(timeEntries)
    .values({
      userId,
      category,
      label: label ?? null,
      startAt,
      localDate: toLocalDate(startAt, timezone),
      source,
    })
    .returning();
  return { started, stopped };
}

/** Records an already-finished session ending now (or at midday on `date`). */
export async function logTimeEntry(
  userId: string,
  timezone: string,
  input: TimeEntryInput,
  source: EntrySource = "web",
): Promise<TimeEntry> {
  const endAt = input.date ? new Date(`${input.date}T12:00:00Z`) : new Date();
  const startAt = new Date(endAt.getTime() - input.minutes * 60_000);
  const [created] = await db
    .insert(timeEntries)
    .values({
      userId,
      category: input.category,
      label: input.label ?? null,
      startAt,
      endAt,
      durationMinutes: input.minutes,
      localDate: input.date ?? toLocalDate(startAt, timezone),
      notes: input.notes ?? null,
      source,
    })
    .returning();
  return created;
}

export async function listTimeEntries(userId: string, date: LocalDate): Promise<TimeEntry[]> {
  return db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), eq(timeEntries.localDate, date)))
    .orderBy(asc(timeEntries.startAt));
}

export async function deleteTimeEntry(userId: string, entryId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(timeEntries)
    .where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
    .returning({ id: timeEntries.id });
  return Boolean(deleted);
}

/** Minutes per category for a list of entries, running timers counted to now. */
export function minutesByCategory(entries: TimeEntry[], now = new Date()): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const entry of entries) {
    const minutes = entry.durationMinutes ?? minutesBetween(entry.startAt, now);
    totals[entry.category] = (totals[entry.category] ?? 0) + minutes;
  }
  return totals;
}
