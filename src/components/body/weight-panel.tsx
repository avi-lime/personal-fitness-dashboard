"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/common/stat";
import { EmptyState } from "@/components/common/empty-state";
import { LineChart, toLinePoints } from "@/components/charts/line-chart";
import { useAction } from "@/components/common/use-action";
import { useLogDialogs } from "@/components/log/log-provider";
import { deleteWeightAction } from "@/server/actions/logging";
import { formatSigned, formatValue } from "@/lib/format";
import type { WeightStats } from "@/lib/aggregate";

export interface WeightEntryView {
  id: string;
  date: string;
  weightKg: number;
  note: string | null;
  time: string;
}

export function WeightPanel({
  stats,
  series,
  entries,
  targetWeightKg,
  startingWeightKg,
}: {
  stats: WeightStats;
  series: Array<{ date: string; weightKg: number }>;
  entries: WeightEntryView[];
  targetWeightKg: number | null;
  startingWeightKg: number | null;
}) {
  const { open } = useLogDialogs();
  const { pending, run } = useAction();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Weight</h2>
        <Button size="sm" onClick={() => open("weight")}>
          Log weight
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No weigh-ins yet" description="Log your first weight to start a trend." />
      ) : (
        <>
          <Card className="gap-4 p-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <Stat label="Latest" value={`${formatValue(stats.latest ?? 0)} kg`} detail={stats.latestDate ?? undefined} />
              <Stat
                label="7-day avg"
                value={stats.sevenDayAverage === null ? "—" : `${formatValue(stats.sevenDayAverage)} kg`}
              />
              <Stat
                label="This week"
                value={stats.changeThisWeek === null ? "—" : `${formatSigned(stats.changeThisWeek, 2)} kg`}
              />
              <Stat
                label="Since start"
                value={
                  stats.changeSinceStart === null ? "—" : `${formatSigned(stats.changeSinceStart, 2)} kg`
                }
                detail={startingWeightKg ? `profile start ${formatValue(startingWeightKg)} kg` : undefined}
              />
              <Stat
                label="Target"
                value={targetWeightKg ? `${formatValue(targetWeightKg)} kg` : "—"}
                detail={
                  targetWeightKg && stats.latest !== null
                    ? `${formatSigned(targetWeightKg - stats.latest, 1)} kg to go`
                    : "not configured"
                }
              />
            </div>
            <LineChart
              points={toLinePoints(series.map((point) => ({ date: point.date, value: point.weightKg })))}
              unit="kg"
              ariaLabel="Body weight over time"
              height={200}
            />
          </Card>

          <Card className="gap-0 p-0">
            <h3 className="border-b px-4 py-2.5 text-sm font-medium">Weigh-ins</h3>
            <ul className="divide-y">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-4 px-4 py-2.5">
                  <span className="tabular w-28 text-sm">{entry.date}</span>
                  <span className="tabular w-16 text-sm text-muted-foreground">{entry.time}</span>
                  <span className="tabular flex-1 text-sm font-medium">
                    {formatValue(entry.weightKg, 2)} kg
                  </span>
                  {entry.note ? (
                    <span className="text-sm text-muted-foreground">{entry.note}</span>
                  ) : null}
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending}
                    aria-label={`Delete weigh-in from ${entry.date}`}
                    onClick={() => run(() => deleteWeightAction(entry.id), { success: "Entry deleted" })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
