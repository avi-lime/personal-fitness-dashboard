"use client";

import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/common/use-action";
import { useLogDialogs } from "@/components/log/log-provider";
import { logWaterAction, recordGoalEntryAction } from "@/server/actions/logging";
import type { GoalType, MetricKey } from "@/lib/domain";

/**
 * The fastest sensible action for a goal, chosen from its metric source.
 * Metric-backed goals open the matching log dialog; manual goals record an
 * entry directly.
 */
export function GoalQuickAdd({
  goalId,
  metricKey,
  type,
  complete,
}: {
  goalId: string;
  metricKey: MetricKey | null;
  type: GoalType;
  complete: boolean;
}) {
  const { open } = useLogDialogs();
  const { pending, run } = useAction();

  if (metricKey === "water_ml") {
    return (
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => run(() => logWaterAction({ milliliters: 250 }), { success: "+250 ml water" })}
        aria-label="Add 250 millilitres of water"
      >
        <Plus className="size-3.5" aria-hidden /> 250 ml
      </Button>
    );
  }

  const dialogFor: Partial<Record<MetricKey, Parameters<typeof open>[0]>> = {
    calories: "food",
    protein: "food",
    carbs: "food",
    fat: "food",
    sleep_hours: "sleep",
    workouts: "workout",
    body_weight_kg: "weight",
  };

  if (metricKey && dialogFor[metricKey]) {
    const kind = dialogFor[metricKey];
    return (
      <Button size="sm" variant="ghost" onClick={() => kind && open(kind)}>
        <Plus className="size-3.5" aria-hidden /> Log
      </Button>
    );
  }

  if (metricKey) return null;

  const label = type === "boolean" ? (complete ? "Done" : "Mark done") : "+1";
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending || (type === "boolean" && complete)}
      onClick={() => run(() => recordGoalEntryAction({ goalId, value: 1 }), { success: "Recorded" })}
    >
      {type === "boolean" ? (
        <Check className="size-3.5" aria-hidden />
      ) : (
        <Plus className="size-3.5" aria-hidden />
      )}
      {label}
    </Button>
  );
}
