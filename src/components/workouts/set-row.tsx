"use client";

import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/common/use-action";
import { deleteSetAction, updateSetAction } from "@/server/actions/workouts";
import { cn } from "@/lib/utils";
import type { WorkoutSetView } from "@/server/services/workouts";

const parse = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * One set, rendered as cells of the exercise grid (so it reflows on phones).
 * Values commit on blur so typing never fires a request per keystroke.
 */
export function SetRow({ set, index }: { set: WorkoutSetView; index: number }) {
  const { pending, run } = useAction();
  const commit = (patch: { reps?: number | null; weightKg?: number | null; rpe?: number | null }) =>
    run(() => updateSetAction({ setId: set.id, ...patch }));
  const muted = set.completed ? "text-muted-foreground" : undefined;

  return (
    <>
      <span className={cn("tabular text-sm", muted)}>{index + 1}</span>
      <Input
        defaultValue={set.reps ?? ""}
        inputMode="numeric"
        aria-label={`Set ${index + 1} reps`}
        className="tabular h-8 w-full"
        onBlur={(event) => {
          const reps = parse(event.target.value);
          if (reps !== set.reps) commit({ reps: reps === null ? null : Math.round(reps) });
        }}
      />
      <Input
        defaultValue={set.weightKg ?? ""}
        inputMode="decimal"
        aria-label={`Set ${index + 1} weight in kilograms`}
        className="tabular h-8 w-full"
        onBlur={(event) => {
          const weightKg = parse(event.target.value);
          if (weightKg !== set.weightKg) commit({ weightKg });
        }}
      />
      <Input
        defaultValue={set.rpe ?? ""}
        inputMode="decimal"
        aria-label={`Set ${index + 1} RPE`}
        className="tabular h-8 w-full"
        onBlur={(event) => {
          const rpe = parse(event.target.value);
          if (rpe !== set.rpe) commit({ rpe });
        }}
      />
      <Button
        size="icon"
        variant={set.completed ? "default" : "outline"}
        disabled={pending}
        aria-pressed={set.completed}
        aria-label={set.completed ? `Set ${index + 1} done` : `Mark set ${index + 1} done`}
        onClick={() => run(() => updateSetAction({ setId: set.id, completed: !set.completed }))}
      >
        <Check className="size-4" aria-hidden />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={pending}
        aria-label={`Delete set ${index + 1}`}
        onClick={() => run(() => deleteSetAction(set.id), { success: "Set removed" })}
      >
        <Trash2 className="size-4" />
      </Button>
    </>
  );
}
