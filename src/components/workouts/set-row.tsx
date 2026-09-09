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
 * One set. Values commit on blur so typing never fires a request per keystroke.
 */
export function SetRow({ set, index }: { set: WorkoutSetView; index: number }) {
  const { pending, run } = useAction();

  const commit = (patch: { reps?: number | null; weightKg?: number | null; rpe?: number | null }) =>
    run(() => updateSetAction({ setId: set.id, ...patch }));

  return (
    <tr className={cn(set.completed && "text-muted-foreground")}>
      <td className="tabular py-1.5 pr-3 text-sm">{index + 1}</td>
      <td className="py-1.5 pr-3">
        <Input
          defaultValue={set.reps ?? ""}
          inputMode="numeric"
          aria-label={`Set ${index + 1} reps`}
          className="tabular h-8 w-20"
          onBlur={(event) => {
            const reps = parse(event.target.value);
            if (reps !== set.reps) commit({ reps: reps === null ? null : Math.round(reps) });
          }}
        />
      </td>
      <td className="py-1.5 pr-3">
        <Input
          defaultValue={set.weightKg ?? ""}
          inputMode="decimal"
          aria-label={`Set ${index + 1} weight in kilograms`}
          className="tabular h-8 w-24"
          onBlur={(event) => {
            const weightKg = parse(event.target.value);
            if (weightKg !== set.weightKg) commit({ weightKg });
          }}
        />
      </td>
      <td className="py-1.5 pr-3">
        <Input
          defaultValue={set.rpe ?? ""}
          inputMode="decimal"
          aria-label={`Set ${index + 1} RPE`}
          className="tabular h-8 w-16"
          onBlur={(event) => {
            const rpe = parse(event.target.value);
            if (rpe !== set.rpe) commit({ rpe });
          }}
        />
      </td>
      <td className="py-1.5 pr-3">
        <Button
          size="sm"
          variant={set.completed ? "default" : "outline"}
          disabled={pending}
          aria-pressed={set.completed}
          onClick={() => run(() => updateSetAction({ setId: set.id, completed: !set.completed }))}
        >
          <Check className="size-3.5" aria-hidden />
          {set.completed ? "Done" : "Mark"}
        </Button>
      </td>
      <td className="py-1.5">
        <Button
          size="icon"
          variant="ghost"
          disabled={pending}
          aria-label={`Delete set ${index + 1}`}
          onClick={() => run(() => deleteSetAction(set.id), { success: "Set removed" })}
        >
          <Trash2 className="size-4" />
        </Button>
      </td>
    </tr>
  );
}
