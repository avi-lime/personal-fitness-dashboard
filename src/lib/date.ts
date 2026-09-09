/**
 * Timezone-aware date helpers.
 *
 * Every logged event stores an absolute `occurredAt` timestamp *and* a
 * `localDate` (YYYY-MM-DD) bucket computed in the user's timezone. The bucket
 * is what makes "today" queries cheap and unambiguous; it is a key, not a
 * cached aggregate.
 */

/** A calendar day in YYYY-MM-DD form. */
export type LocalDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): value is LocalDate {
  if (!ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === m - 1 &&
    probe.getUTCDate() === d
  );
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The calendar day `instant` falls on, as seen from `timeZone`. */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** The wall-clock time of `instant` in `timeZone`, e.g. "21:04". */
export function toLocalTime(instant: Date, timeZone: string, withSeconds = false): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" as const } : {}),
    hour12: false,
  }).format(instant);
}

/** Parses a YYYY-MM-DD string into its numeric parts. */
function parts(date: LocalDate): [number, number, number] {
  const [y, m, d] = date.split("-").map(Number);
  return [y, m, d];
}

function fromUtcProbe(probe: Date): LocalDate {
  return probe.toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const [y, m, d] = parts(date);
  return fromUtcProbe(new Date(Date.UTC(y, m - 1, d + days)));
}

export function diffInDays(from: LocalDate, to: LocalDate): number {
  const [ay, am, ad] = parts(from);
  const [by, bm, bd] = parts(to);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(date: LocalDate): number {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday-based week start, matching the weekly review. */
export function startOfWeek(date: LocalDate): LocalDate {
  const shift = (dayOfWeek(date) + 6) % 7;
  return addDays(date, -shift);
}

export function endOfWeek(date: LocalDate): LocalDate {
  return addDays(startOfWeek(date), 6);
}

export function startOfMonth(date: LocalDate): LocalDate {
  const [y, m] = parts(date);
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
}

export function endOfMonth(date: LocalDate): LocalDate {
  const [y, m] = parts(date);
  return fromUtcProbe(new Date(Date.UTC(y, m, 0)));
}

/** Inclusive list of dates from `start` to `end`. */
export function eachDay(start: LocalDate, end: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  const total = diffInDays(start, end);
  for (let i = 0; i <= total; i += 1) out.push(addDays(start, i));
  return out;
}

/** The last `count` days ending at (and including) `date`. */
export function lastNDays(date: LocalDate, count: number): LocalDate[] {
  return eachDay(addDays(date, -(count - 1)), date);
}

/**
 * The UTC instant range covering a local calendar day. Used to query
 * timestamp columns without relying on database timezone settings.
 */
export function localDayBounds(date: LocalDate, timeZone: string): { start: Date; end: Date } {
  const [y, m, d] = parts(date);
  const guess = Date.UTC(y, m - 1, d, 12, 0, 0);
  const offsetMs = timeZoneOffsetMs(new Date(guess), timeZone);
  const start = new Date(Date.UTC(y, m - 1, d) - offsetMs);
  const end = new Date(Date.UTC(y, m - 1, d + 1) - offsetMs);
  return { start, end };
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
export function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, number> = {};
  for (const { type, value } of formatter.formatToParts(instant)) {
    if (type !== "literal") map[type] = Number(value);
  }
  const asUtc = Date.UTC(
    map.year,
    map.month - 1,
    map.day,
    map.hour === 24 ? 0 : map.hour,
    map.minute,
    map.second,
  );
  return asUtc - instant.getTime();
}

export function formatLongDate(date: LocalDate, timeZone: string): string {
  const [y, m, d] = parts(date);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function formatShortDate(date: LocalDate): string {
  const [y, m, d] = parts(date);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** Hours between two instants, rounded to two decimals. */
export function hoursBetween(start: Date, end: Date): number {
  return Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100;
}
