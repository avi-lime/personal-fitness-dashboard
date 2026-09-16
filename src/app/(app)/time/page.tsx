import { TimePanel } from "@/components/time/time-panel";
import { requireContext } from "@/server/auth";
import { getRunningTimer, listTimeEntries, minutesByCategory } from "@/server/services/time";
import { getHistory } from "@/server/services/summary";
import { addDays, toLocalDate, toLocalTime } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "Time · Life Dashboard" };

export default async function TimePage() {
  const { user, timezone } = await requireContext();
  const today = toLocalDate(new Date(), timezone);
  const [running, entries, week] = await Promise.all([
    getRunningTimer(user.id),
    listTimeEntries(user.id, today),
    getHistory(user.id, addDays(today, -6), today),
  ]);
  const finished = entries.filter((entry) => entry.endAt !== null);

  return (
    <TimePanel
      running={
        running
          ? {
              id: running.id,
              category: running.category,
              label: running.label,
              startedAtIso: running.startAt.toISOString(),
            }
          : null
      }
      entries={entries.map((entry) => ({
        id: entry.id,
        category: entry.category,
        label: entry.label,
        start: toLocalTime(entry.startAt, timezone),
        end: entry.endAt ? toLocalTime(entry.endAt, timezone) : null,
        minutes: entry.durationMinutes,
      }))}
      totalsToday={minutesByCategory(finished)}
      weekMinutes={week.map((day) =>
        Object.values(day.minutesByCategory).reduce((sum, minutes) => sum + minutes, 0),
      )}
    />
  );
}
