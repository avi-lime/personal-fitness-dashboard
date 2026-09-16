"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { GoalFormDialog } from "@/components/goals/goal-form-dialog";
import { archiveGoalAction, reorderGoalsAction, updateGoalAction } from "@/server/actions/goals";
import { metricLabel } from "@/lib/metrics";
import { formatValue } from "@/lib/format";
import type { GoalLike } from "@/lib/goals";

const PERIOD_LABEL: Record<GoalLike["period"], string> = {
  daily: "per day",
  weekly: "per week",
  monthly: "per month",
  one_time: "one-time",
};

/**
 * Full goal management: add, edit, pause, reorder, archive, and control where
 * each goal appears. Reordering uses buttons rather than drag-and-drop so it
 * works with a keyboard and a screen reader.
 */
export function GoalManager({ goals }: { goals: GoalLike[] }) {
  const [editing, setEditing] = useState<GoalLike | null>(null);
  const [creating, setCreating] = useState(false);
  const { pending, run } = useAction();

  const move = (index: number, direction: -1 | 1) => {
    const next = [...goals];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderGoalsAction(next.map((goal) => goal.id)), { success: "Order updated" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl">Goals</h1>
          <p className="text-sm text-muted-foreground">
            Everything on the dashboard is generated from these.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden /> Add goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          title="No goals yet"
          description="Add your first goal — for example 100 g of protein per day."
          action={<Button size="sm" onClick={() => setCreating(true)}>Add goal</Button>}
        />
      ) : (
        <ul className="space-y-2">
          {goals.map((goal, index) => (
            <li key={goal.id}>
              <Card className="gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-medium">{goal.name}</h2>
                      <Badge variant="secondary" className="capitalize">
                        {goal.type}
                      </Badge>
                      {!goal.active ? <Badge variant="outline">Paused</Badge> : null}
                    </div>
                    <p className="tabular text-sm text-muted-foreground">
                      {goal.targetValue === null
                        ? "No target"
                        : `${formatValue(goal.targetValue)}${goal.unit ? ` ${goal.unit}` : ""} ${
                            PERIOD_LABEL[goal.period]
                          }`}
                      <span className="mx-1.5">·</span>
                      {metricLabel(goal.metricKey, goal.metricParam)}
                    </p>
                    {goal.description ? (
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Move ${goal.name} up`}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || index === goals.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Move ${goal.name} down`}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(goal)}
                      aria-label={`Edit ${goal.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Archive "${goal.name}"? Past entries are kept, but it disappears from the dashboard.`,
                          )
                        ) {
                          run(() => archiveGoalAction(goal.id), { success: "Goal archived" });
                        }
                      }}
                      aria-label={`Archive ${goal.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-3">
                  <Toggle
                    id={`active-${goal.id}`}
                    label="Active"
                    checked={goal.active}
                    disabled={pending}
                    onChange={(checked) =>
                      run(() => updateGoalAction({ goalId: goal.id, patch: { active: checked } }), {
                        success: checked ? "Goal resumed" : "Goal paused",
                      })
                    }
                  />
                  <Toggle
                    id={`dashboard-${goal.id}`}
                    label="On dashboard"
                    checked={goal.visibleOnDashboard}
                    disabled={pending}
                    onChange={(checked) =>
                      run(
                        () =>
                          updateGoalAction({
                            goalId: goal.id,
                            patch: { visibleOnDashboard: checked },
                          }),
                        { success: "Dashboard visibility updated" },
                      )
                    }
                  />
                  <Toggle
                    id={`checklist-${goal.id}`}
                    label="In checklist"
                    checked={goal.showInChecklist}
                    disabled={pending}
                    onChange={(checked) =>
                      run(
                        () =>
                          updateGoalAction({ goalId: goal.id, patch: { showInChecklist: checked } }),
                        { success: "Checklist visibility updated" },
                      )
                    }
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <GoalFormDialog open={creating} onOpenChange={setCreating} />
      <GoalFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        goal={editing}
      />
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
    </div>
  );
}
