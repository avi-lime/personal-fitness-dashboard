import { Card } from "@/components/ui/card";
import { Stat } from "@/components/common/stat";
import { LineChart, toLinePoints } from "@/components/charts/line-chart";
import { EmptyState } from "@/components/common/empty-state";
import { LogWeightButton } from "@/components/dashboard/log-weight-button";
import { formatSigned, formatValue } from "@/lib/format";
import type { WeightStats } from "@/lib/aggregate";
import type { LocalDate } from "@/lib/date";

export function BodyCard({
  stats,
  series,
  targetWeightKg,
}: {
  stats: WeightStats;
  series: Array<{ date: LocalDate; weightKg: number }>;
  targetWeightKg: number | null;
}) {
  if (stats.latest === null) {
    return (
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-medium">Body</h2>
        <EmptyState
          title="No weigh-ins yet"
          description="Log a weight to start tracking your trend."
          action={<LogWeightButton />}
        />
      </Card>
    );
  }

  const points = toLinePoints(series.map((point) => ({ date: point.date, value: point.weightKg })));

  return (
    <Card className="gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Body</h2>
        <LogWeightButton variant="ghost" label="Log weight" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Current"
          value={`${formatValue(stats.latest)} kg`}
          detail={targetWeightKg ? `Target ${formatValue(targetWeightKg)} kg` : "No target set"}
        />
        <Stat
          label="7-day avg"
          value={stats.sevenDayAverage === null ? "—" : `${formatValue(stats.sevenDayAverage)} kg`}
        />
        <Stat
          label="This week"
          value={
            stats.changeThisWeek === null ? "—" : `${formatSigned(stats.changeThisWeek, 2)} kg`
          }
          detail="vs previous 7 days"
        />
        <Stat
          label="Since start"
          value={
            stats.changeSinceStart === null ? "—" : `${formatSigned(stats.changeSinceStart, 2)} kg`
          }
          detail={stats.firstDate ? `from ${formatValue(stats.first ?? 0)} kg` : undefined}
        />
      </div>

      <LineChart points={points} unit="kg" ariaLabel="Body weight over time" height={160} />
    </Card>
  );
}
