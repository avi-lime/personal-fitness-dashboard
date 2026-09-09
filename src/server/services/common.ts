import "server-only";
import { toLocalDate, type LocalDate } from "@/lib/date";

/** Resolves an optional ISO timestamp to an instant, defaulting to now. */
export function resolveInstant(occurredAt?: string | null): Date {
  if (!occurredAt) return new Date();
  const parsed = new Date(occurredAt);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid timestamp: ${occurredAt}`);
  return parsed;
}

/** The (instant, local day) pair every event row stores. */
export function eventTiming(
  timezone: string,
  occurredAt?: string | null,
): { occurredAt: Date; localDate: LocalDate } {
  const instant = resolveInstant(occurredAt);
  return { occurredAt: instant, localDate: toLocalDate(instant, timezone) };
}
