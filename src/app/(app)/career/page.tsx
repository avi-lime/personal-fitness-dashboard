import { ApplicationsBoard } from "@/components/career/applications-board";
import { requireContext } from "@/server/auth";
import { listApplications } from "@/server/services/career";
import { getHistory } from "@/server/services/summary";
import { startOfWeek, toLocalDate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "Career · Life Dashboard" };

export default async function CareerPage() {
  const { user, timezone } = await requireContext();
  const today = toLocalDate(new Date(), timezone);
  const [applications, week] = await Promise.all([
    listApplications(user.id),
    getHistory(user.id, startOfWeek(today), today),
  ]);

  return (
    <ApplicationsBoard
      applications={applications}
      today={today}
      sentThisWeek={week.reduce((sum, day) => sum + day.applicationsSent, 0)}
      prepMinutesThisWeek={week.reduce(
        (sum, day) => sum + (day.minutesByCategory.study ?? 0) + (day.minutesByCategory.career ?? 0),
        0,
      )}
    />
  );
}
