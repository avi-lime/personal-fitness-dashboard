import { dayOfWeek, type LocalDate } from "./date";

/**
 * Pure helpers for the daily plan: weekday masks for routines and HH:MM
 * arithmetic for blocks. Times are wall-clock strings in the user's timezone;
 * zero-padded HH:MM compares correctly as plain text.
 */
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isHHMM(value: string): boolean {
  return HHMM.test(value);
}

export function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function hhmmFromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(total)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Bit i of the mask is set when the routine runs on WEEKDAYS[i]. */
export function weekdayMask(days: readonly Weekday[]): number {
  return days.reduce((mask, day) => mask | (1 << WEEKDAYS.indexOf(day)), 0);
}

export function maskToWeekdays(mask: number): Weekday[] {
  return WEEKDAYS.filter((_, index) => (mask & (1 << index)) !== 0);
}

/** Monday-first weekday of a calendar date. */
export function weekdayOf(date: LocalDate): Weekday {
  // dayOfWeek: 0 = Sunday … 6 = Saturday.
  return WEEKDAYS[(dayOfWeek(date) + 6) % 7];
}

export function routineAppliesOn(mask: number, date: LocalDate): boolean {
  return (mask & (1 << WEEKDAYS.indexOf(weekdayOf(date)))) !== 0;
}

export interface BlockLike {
  startTime: string;
  endTime: string;
  done?: boolean;
}

/** The block whose window contains `now` (HH:MM), if any. */
export function currentBlock<T extends BlockLike>(blocks: readonly T[], now: string): T | null {
  return blocks.find((block) => block.startTime <= now && now < block.endTime) ?? null;
}

/** The next block starting after `now`, in start order. */
export function nextBlock<T extends BlockLike>(blocks: readonly T[], now: string): T | null {
  return (
    [...blocks]
      .filter((block) => block.startTime > now)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] ?? null
  );
}

export function sortBlocks<T extends BlockLike>(blocks: readonly T[]): T[] {
  return [...blocks].sort(
    (a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime),
  );
}
