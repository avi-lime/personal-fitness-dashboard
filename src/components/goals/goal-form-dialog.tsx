"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { createGoalAction, updateGoalAction } from "@/server/actions/goals";
import {
  GOAL_PERIODS,
  GOAL_TYPES,
  type AreaKey,
  type GoalPeriod,
  type GoalType,
  type MetricKey,
} from "@/lib/domain";
import { METRICS, METRIC_LIST } from "@/lib/metrics";
import { AreaSelect } from "@/components/common/area-select";
import type { GoalLike } from "@/lib/goals";

const MANUAL = "manual";

const PERIOD_LABEL: Record<GoalPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  one_time: "One-time",
};

const TYPE_HINT: Record<GoalType, string> = {
  numeric: "A measured amount, e.g. 100 g of protein.",
  duration: "A length of time in hours, e.g. 7.5 h of sleep.",
  boolean: "Done or not done today.",
  count: "A number of occurrences, e.g. 1 workout.",
};

interface FormState {
  name: string;
  description: string;
  type: GoalType;
  period: GoalPeriod;
  unit: string;
  targetValue: string;
  metricKey: string;
  metricParam: AreaKey | null;
  area: AreaKey | null;
  visibleOnDashboard: boolean;
  showInChecklist: boolean;
}

const BLANK: FormState = {
  name: "",
  description: "",
  type: "numeric",
  period: "daily",
  unit: "",
  targetValue: "",
  metricKey: MANUAL,
  metricParam: null,
  area: null,
  visibleOnDashboard: true,
  showInChecklist: true,
};

/**
 * Create or edit a goal. The metric source is the important field: it decides
 * whether progress is derived from logged events or recorded by hand.
 */
export function GoalFormDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: GoalLike | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{goal ? "Edit goal" : "Add goal"}</DialogTitle>
          <DialogDescription>
            Goals drive the dashboard, the checklist and the weekly review.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <GoalForm key={goal?.id ?? "new"} goal={goal} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function initialState(goal?: GoalLike | null): FormState {
  if (!goal) return BLANK;
  return {
    name: goal.name,
    description: goal.description ?? "",
    type: goal.type,
    period: goal.period,
    unit: goal.unit ?? "",
    targetValue: goal.targetValue === null ? "" : String(goal.targetValue),
    metricKey: goal.metricKey ?? MANUAL,
    metricParam: (goal.metricParam as AreaKey | null) ?? null,
    area: goal.area,
    visibleOnDashboard: goal.visibleOnDashboard,
    showInChecklist: goal.showInChecklist,
  };
}

function GoalForm({ goal, onDone }: { goal?: GoalLike | null; onDone: () => void }) {
  const [form, setForm] = useState<FormState>(() => initialState(goal));
  const { pending, run } = useAction();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  const chooseMetric = (value: string) => {
    if (value === MANUAL) {
      setForm((previous) => ({ ...previous, metricKey: MANUAL, metricParam: null }));
      return;
    }
    const metric = METRIC_LIST.find((item) => item.key === value);
    setForm((previous) => ({
      ...previous,
      metricKey: value,
      metricParam: metric?.param ? (previous.metricParam ?? "study") : null,
      unit: previous.unit || (metric?.defaultUnit ?? ""),
      type: metric?.suggestedType ?? previous.type,
    }));
  };
  const paramNeeded = form.metricKey !== MANUAL && Boolean(METRICS[form.metricKey as MetricKey]?.param);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const target = form.targetValue.trim();
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() === "" ? null : form.description.trim(),
      type: form.type,
      period: form.period,
      unit: form.unit.trim() === "" ? null : form.unit.trim(),
      targetValue: target === "" ? null : Number(target.replace(",", ".")),
      metricKey: form.metricKey === MANUAL ? null : (form.metricKey as MetricKey),
      metricParam: paramNeeded ? form.metricParam : null,
      area: form.area,
      visibleOnDashboard: form.visibleOnDashboard,
      showInChecklist: form.showInChecklist,
    };

    run(
      () =>
        goal
          ? updateGoalAction({ goalId: goal.id, patch: payload })
          : createGoalAction(payload),
      { success: goal ? "Goal updated" : "Goal created", onSuccess: onDone },
    );
  };

  return (
        <form onSubmit={submit} className="space-y-4">
          <Field id="goal-name" label="Name">
            <Input
              id="goal-name"
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              required
              autoFocus
              placeholder="Protein"
            />
          </Field>

          <Field
            id="goal-metric"
            label="Tracked from"
            hint="Automatic metrics read your logged entries. Manual goals are recorded by hand."
          >
            <Select value={form.metricKey} onValueChange={chooseMetric}>
              <SelectTrigger id="goal-metric" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MANUAL}>Manual entries</SelectItem>
                {METRIC_LIST.map((metric) => (
                  <SelectItem key={metric.key} value={metric.key}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {paramNeeded ? (
            <Field id="goal-param" label="Category" hint="Which tracked time counts towards this goal.">
              <AreaSelect
                id="goal-param"
                value={form.metricParam}
                onChange={(value) => set("metricParam", value)}
              />
            </Field>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="goal-area" label="Area" hint="Groups the goal with the rest of that part of life.">
              <AreaSelect id="goal-area" value={form.area} onChange={(value) => set("area", value)} allowNone />
            </Field>
            <Field id="goal-type" label="Type" hint={TYPE_HINT[form.type]}>
              <Select value={form.type} onValueChange={(value) => set("type", value as GoalType)}>
                <SelectTrigger id="goal-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="goal-period" label="Period">
              <Select
                value={form.period}
                onValueChange={(value) => set("period", value as GoalPeriod)}
              >
                <SelectTrigger id="goal-period" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_PERIODS.map((period) => (
                    <SelectItem key={period} value={period}>
                      {PERIOD_LABEL[period]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="goal-target" label="Target" hint="Leave blank to track without a target.">
              <Input
                id="goal-target"
                inputMode="decimal"
                value={form.targetValue}
                onChange={(event) => set("targetValue", event.target.value)}
                placeholder="100"
              />
            </Field>
            <Field id="goal-unit" label="Unit">
              <Input
                id="goal-unit"
                value={form.unit}
                onChange={(event) => set("unit", event.target.value)}
                placeholder="g"
              />
            </Field>
          </div>

          <Field id="goal-description" label="Description">
            <Textarea
              id="goal-description"
              value={form.description}
              onChange={(event) => set("description", event.target.value)}
              rows={2}
              placeholder="optional"
            />
          </Field>

          <div className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="goal-visible" className="font-normal">
                Show on dashboard
              </Label>
              <Switch
                id="goal-visible"
                checked={form.visibleOnDashboard}
                onCheckedChange={(checked) => set("visibleOnDashboard", checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="goal-checklist" className="font-normal">
                Count towards the daily checklist
              </Label>
              <Switch
                id="goal-checklist"
                checked={form.showInChecklist}
                onCheckedChange={(checked) => set("showInChecklist", checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || form.name.trim() === ""}>
              {goal ? "Save changes" : "Create goal"}
            </Button>
          </DialogFooter>
        </form>
  );
}
