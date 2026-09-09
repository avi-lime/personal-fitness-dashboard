"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stat } from "@/components/common/stat";
import { ProgressBar } from "@/components/charts/progress-bar";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { deleteWaterLogAction, logWaterAction } from "@/server/actions/logging";
import { WATER_PRESETS_ML } from "@/lib/water-presets";
import { formatValue } from "@/lib/format";

export interface WaterEntryView {
  id: string;
  milliliters: number;
  time: string;
}

export function WaterPanel({
  entries,
  targetLitres,
}: {
  entries: WaterEntryView[];
  targetLitres: number | null;
}) {
  const { pending, run } = useAction();
  const totalMl = entries.reduce((total, entry) => total + entry.milliliters, 0);

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium">Water today</h2>

      <Card className="gap-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Stat
            label="Total"
            value={`${formatValue(totalMl / 1000, 2)} L`}
            detail={targetLitres ? `of ${formatValue(targetLitres)} L target` : "no target set"}
          />
          <div className="flex flex-wrap gap-2">
            {WATER_PRESETS_ML.map((amount) => (
              <Button
                key={amount}
                variant="secondary"
                disabled={pending}
                className="tabular"
                onClick={() =>
                  run(() => logWaterAction({ milliliters: amount }), {
                    success: `+${amount} ml water`,
                  })
                }
              >
                +{amount} ml
              </Button>
            ))}
          </div>
        </div>
        {targetLitres ? (
          <ProgressBar
            value={totalMl / 1000 / targetLitres}
            tone={totalMl / 1000 >= targetLitres ? "positive" : "neutral"}
            label={`Water: ${formatValue(totalMl / 1000, 2)} of ${formatValue(targetLitres)} litres`}
            size="lg"
          />
        ) : null}
      </Card>

      {entries.length === 0 ? (
        <EmptyState title="No water logged today" description="Use a preset above to add some." />
      ) : (
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 px-4 py-2">
                <span className="tabular w-16 text-sm text-muted-foreground">{entry.time}</span>
                <span className="tabular flex-1 text-sm">{entry.milliliters} ml</span>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Delete ${entry.milliliters} ml entry`}
                  onClick={() =>
                    run(() => deleteWaterLogAction(entry.id), { success: "Entry deleted" })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
