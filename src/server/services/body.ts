import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { sleepEntries, weightEntries } from "@/db/schema";
import type { SleepEntry, WeightEntry } from "@/db/schema";
import type { EntrySource } from "@/lib/domain";
import { toLocalDate, type LocalDate } from "@/lib/date";
import { eventTiming } from "./common";

// --- Weight ----------------------------------------------------------------

export async function logWeight(
  userId: string,
  timezone: string,
  kilograms: number,
  occurredAtIso?: string | null,
  note?: string | null,
  source: EntrySource = "web",
): Promise<WeightEntry> {
  const { occurredAt, localDate } = eventTiming(timezone, occurredAtIso);
  const [created] = await db
    .insert(weightEntries)
    .values({ userId, weightKg: kilograms, occurredAt, localDate, note: note ?? null, source })
    .returning();
  return created;
}

export async function listWeightEntries(userId: string, limit = 60): Promise<WeightEntry[]> {
  return db
    .select()
    .from(weightEntries)
    .where(eq(weightEntries.userId, userId))
    .orderBy(desc(weightEntries.occurredAt))
    .limit(limit);
}

export async function deleteWeightEntry(userId: string, entryId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(weightEntries)
    .where(and(eq(weightEntries.id, entryId), eq(weightEntries.userId, userId)))
    .returning({ id: weightEntries.id });
  return Boolean(deleted);
}

export async function latestWeight(userId: string): Promise<WeightEntry | null> {
  const [row] = await db
    .select()
    .from(weightEntries)
    .where(eq(weightEntries.userId, userId))
    .orderBy(desc(weightEntries.occurredAt))
    .limit(1);
  return row ?? null;
}

// --- Sleep -----------------------------------------------------------------

export async function logSleep(
  userId: string,
  timezone: string,
  input: { startTime: string; endTime: string; quality?: number | null; note?: string | null },
  source: EntrySource = "web",
): Promise<SleepEntry> {
  const startAt = new Date(input.startTime);
  const endAt = new Date(input.endTime);
  // A night's sleep is attributed to the day the user woke up.
  const localDate = toLocalDate(endAt, timezone);
  const [created] = await db
    .insert(sleepEntries)
    .values({
      userId,
      startAt,
      endAt,
      localDate,
      quality: input.quality ?? null,
      note: input.note ?? null,
      source,
    })
    .returning();
  return created;
}

export async function listSleepEntries(userId: string, limit = 30): Promise<SleepEntry[]> {
  return db
    .select()
    .from(sleepEntries)
    .where(eq(sleepEntries.userId, userId))
    .orderBy(desc(sleepEntries.endAt))
    .limit(limit);
}

export async function sleepForDay(userId: string, date: LocalDate): Promise<SleepEntry[]> {
  return db
    .select()
    .from(sleepEntries)
    .where(and(eq(sleepEntries.userId, userId), eq(sleepEntries.localDate, date)))
    .orderBy(asc(sleepEntries.startAt));
}

export async function deleteSleepEntry(userId: string, entryId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(sleepEntries)
    .where(and(eq(sleepEntries.id, entryId), eq(sleepEntries.userId, userId)))
    .returning({ id: sleepEntries.id });
  return Boolean(deleted);
}
