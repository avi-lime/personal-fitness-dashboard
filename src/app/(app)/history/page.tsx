import { Card } from "@/components/ui/card";
import { Stat } from "@/components/common/stat";
import { LineChart } from "@/components/charts/line-chart";
import { HistoryTable } from "@/components/history/history-table";
import { RangeTabs } from "@/components/history/range-tabs";
import { requireContext } from "@/server/auth";
import { getHistory } from "@/server/services/summary";
import { summarizePeriod } from "@/lib/aggregate";
import { addDays, formatShortDate, toLocalDate } from "@/lib/date";
import { formatDuration, formatValue } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "History · Life Dashboard" };

export default async function HistoryPage({ searchParams }: PageProps<"/history">) {
  const { user, timezone } = await requireContext();
  const params = await searchParams;
  const requested = Number(Array.isArray(params.days) ? params.days[0] : params.days);
  const days = [7, 30, 90].includes(requested) ? requested : 30;

  const today = toLocalDate(new Date(), timezone);
  const start = addDays(today, -(days - 1));
  const history = await getHistory(user.id, start, today);
  const summary = summarizePeriod(history, start, today);

  const chart = (pick: (day: (typeof history)[number]) => number) =>
    history
      .filter((day) => pick(day) > 0)
      .map((day) => ({ label: formatShortDate(day.date), value: pick(day) }));

  const weightPoints = history
    .filter((day) => day.weightKg !== null)
    .map((day) => ({ label: formatShortDate(day.date), value: day.weightKg as number }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">History</h1>
          <p className="text-sm text-muted-foreground">
            Averages are taken over the {summary.daysWithData} days that have data.
          </p>
        </div>
        <RangeTabs active={days} basePath="/history" />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Calories" value={formatValue(summary.averages.calories)} detail="daily avg" />
          <Stat
            label="Protein"
            value={`${formatValue(summary.averages.protein)} g`}
            detail="daily avg"
          />
          <Stat
            label="Water"
            value={`${formatValue(summary.averages.waterMl / 1000, 2)} L`}
            detail="daily avg"
          />
          <Stat
            label="Sleep"
            value={summary.averages.sleepHours ? formatDuration(summary.averages.sleepHours) : "—"}
            detail="daily avg"
          />
          <Stat label="Workouts" value={summary.totals.workouts} detail={`in ${days} days`} />
          <Stat
            label="Weight"
            value={summary.weight.latest === null ? "—" : `${formatValue(summary.weight.latest)} kg`}
            detail={
              summary.weight.changeSinceStart === null
                ? undefined
                : `${formatValue(summary.weight.changeSinceStart, 2)} kg over range`
            }
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium">Calories</h2>
          <LineChart points={chart((day) => day.calories)} unit="" ariaLabel="Calories per day" />
        </Card>
        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium">Protein</h2>
          <LineChart points={chart((day) => day.protein)} unit="g" ariaLabel="Protein per day" />
        </Card>
        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium">Weight</h2>
          <LineChart points={weightPoints} unit="kg" ariaLabel="Weight over the range" />
        </Card>
        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium">Sleep</h2>
          <LineChart points={chart((day) => day.sleepHours)} unit="h" ariaLabel="Sleep per day" />
        </Card>
      </div>

      <HistoryTable days={[...history].reverse()} />
    </div>
  );
}
