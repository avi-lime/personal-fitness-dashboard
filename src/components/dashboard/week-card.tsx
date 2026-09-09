import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/common/stat";
import { Sparkline } from "@/components/charts/sparkline";
import { formatDuration, formatValue } from "@/lib/format";
import type { PeriodSummary } from "@/lib/aggregate";
import type { DayFacts } from "@/lib/metrics";

export function WeekCard({
  summary,
  days,
  goalCompletion,
}: {
  summary: PeriodSummary;
  days: DayFacts[];
  goalCompletion: number;
}) {
  return (
    <Card className="gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Last 7 days</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/review">Weekly review</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Calories" value={formatValue(summary.averages.calories)} detail="daily avg" />
        <Stat label="Protein" value={`${formatValue(summary.averages.protein)} g`} detail="daily avg" />
        <Stat
          label="Water"
          value={`${formatValue(summary.averages.waterMl / 1000)} L`}
          detail="daily avg"
        />
        <Stat
          label="Sleep"
          value={summary.averages.sleepHours ? formatDuration(summary.averages.sleepHours) : "—"}
          detail="daily avg"
        />
        <Stat label="Workouts" value={summary.totals.workouts} detail="sessions" />
        <Stat
          label="Goals met"
          value={`${Math.round(goalCompletion * 100)}%`}
          detail="checklist today"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 border-t pt-3 sm:grid-cols-4">
        <TrendCell label="Calories" values={days.map((day) => day.calories)} />
        <TrendCell label="Protein" values={days.map((day) => day.protein)} />
        <TrendCell label="Water" values={days.map((day) => day.waterMl)} />
        <TrendCell label="Sleep" values={days.map((day) => day.sleepHours)} />
      </div>
    </Card>
  );
}

function TrendCell({ label, values }: { label: string; values: number[] }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {values.some((value) => value > 0) ? (
        <Sparkline values={values} ariaLabel={`${label} over the last 7 days`} />
      ) : (
        <p className="text-xs text-muted-foreground">No data</p>
      )}
    </div>
  );
}
