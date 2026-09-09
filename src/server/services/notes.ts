import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notes } from "@/db/schema";
import type { Note } from "@/db/schema";
import type { EntrySource } from "@/lib/domain";
import { toLocalDate, type LocalDate } from "@/lib/date";

export async function addNote(
  userId: string,
  timezone: string,
  body: string,
  date?: LocalDate | null,
  source: EntrySource = "web",
): Promise<Note> {
  const localDate = date ?? toLocalDate(new Date(), timezone);
  const [created] = await db
    .insert(notes)
    .values({ userId, localDate, body, source })
    .returning();
  return created;
}

export async function listNotes(userId: string, limit = 30): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(eq(notes.userId, userId))
    .orderBy(desc(notes.createdAt))
    .limit(limit);
}

export async function listNotesForDate(userId: string, date: LocalDate): Promise<Note[]> {
  return db
    .select()
    .from(notes)
    .where(and(eq(notes.userId, userId), eq(notes.localDate, date)))
    .orderBy(desc(notes.createdAt));
}

export async function deleteNote(userId: string, noteId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(notes)
    .where(and(eq(notes.id, noteId), eq(notes.userId, userId)))
    .returning({ id: notes.id });
  return Boolean(deleted);
}
