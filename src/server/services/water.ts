import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { waterLogs } from "@/db/schema";
import type { WaterLog } from "@/db/schema";
import type { EntrySource } from "@/lib/domain";
import type { LocalDate } from "@/lib/date";
import { eventTiming } from "./common";

export { WATER_PRESETS_ML } from "@/lib/water-presets";

export async function listWaterLogs(userId: string, date: LocalDate): Promise<WaterLog[]> {
  return db
    .select()
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.localDate, date)))
    .orderBy(asc(waterLogs.occurredAt));
}

export async function logWater(
  userId: string,
  timezone: string,
  milliliters: number,
  occurredAtIso?: string | null,
  source: EntrySource = "web",
): Promise<WaterLog> {
  const { occurredAt, localDate } = eventTiming(timezone, occurredAtIso);
  const [created] = await db
    .insert(waterLogs)
    .values({ userId, milliliters, occurredAt, localDate, source })
    .returning();
  return created;
}

export async function deleteWaterLog(userId: string, logId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(waterLogs)
    .where(and(eq(waterLogs.id, logId), eq(waterLogs.userId, userId)))
    .returning({ id: waterLogs.id });
  return Boolean(deleted);
}

export async function totalWaterForDay(userId: string, date: LocalDate): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${waterLogs.milliliters}), 0)::int` })
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, userId), eq(waterLogs.localDate, date)));
  return row?.total ?? 0;
}
