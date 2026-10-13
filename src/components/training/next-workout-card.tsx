"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Info, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAction } from "@/components/common/use-action";
import { startPlannedWorkoutAction } from "@/server/actions/training";
import { MuscleChip } from "./muscle-chip";
import { PROGRAMS, type DayKey, type ProgramKey } from "@/lib/fitness/programs";
import type { PlannedWorkout } from "@/lib/fitness/planner";
import type { WorkoutView } from "@/server/services/workouts";
import { cn } from "@/lib/utils";

function targetText(exercise: PlannedWorkout["exercises"][number]): string {
  const first = exercise.sets[0];
  if (!first) return "";
  if (first.seconds) return `${exercise.sets.length} × ${first.seconds}s`;
  const weight = first.weightKg ? ` · ${first.weightKg} kg` : "";
  return `${exercise.sets.length} × ${first.reps ?? exercise.range[0]}${weight}`;
}

/** The one thing to do next: today's session, or the one already under way. */
export function NextWorkoutCard({
  plan,
  program,
  active,
  day,
}: {
  plan: PlannedWorkout;
  program: ProgramKey;
  active: WorkoutView | null;
  /** The day picked explicitly, if any (kept in the URL). */
  day: DayKey | null;
}) {
  const router = useRouter();
  const { pending, run } = useAction();
  const [showWhy, setShowWhy] = useState(false);

  if (active) {
    const total = active.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
    const done = active.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0);
    return (
      <Card className="gap-4 bg-surface-3 p-5 ring-1 ring-brand/40">
        <div>
          <p className="text-xs tracking-widest text-brand uppercase">In progress</p>
          <h2 className="font-display text-3xl">{active.name}</h2>
          <p className="text-sm text-muted-foreground tabular">
            {done} of {total} sets done
          </p>
        </div>
        <Button size="lg" className="h-12 text-base" asChild>
          <Link href={`/training/session/${active.id}`}>
            <Play className="size-4" aria-hidden /> Resume
          </Link>
        </Button>
      </Card>
    );
  }

  const start = () =>
    run(() => startPlannedWorkoutAction({ day }), {
      onSuccess: (data) => router.push(`/training/session/${data.workoutId}`),
    });

  return (
    <Card className="gap-4 bg-surface-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">Next · {PROGRAMS[program].name}</p>
          <h2 className="font-display text-3xl">{plan.label} day</h2>
          <p className={cn("text-sm", plan.restSuggested ? "text-brand" : "text-muted-foreground")}>{plan.reason}</p>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground tabular">~{plan.estimatedMinutes} min</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {plan.muscles.map((muscle) => (
          <MuscleChip key={muscle} muscle={muscle} />
        ))}
      </div>

      <ol className="divide-y divide-border/60">
        {plan.exercises.map((exercise, index) => (
          <li key={exercise.key} className="flex items-baseline gap-3 py-2">
            <span className="w-4 shrink-0 text-xs text-muted-foreground tabular">{index + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {exercise.name}
              {exercise.topUp ? <span className="ml-2 text-xs text-brand">top-up</span> : null}
            </span>
            <span className="shrink-0 text-sm text-muted-foreground tabular">{targetText(exercise)}</span>
          </li>
        ))}
      </ol>

      {showWhy ? (
        <ul className="space-y-1 rounded-lg bg-surface-2 p-3 text-xs text-muted-foreground">
          {plan.exercises.flatMap((exercise) =>
            [exercise.rule, ...exercise.notes].map((line, index) => (
              <li key={`${exercise.key}-${index}`}>
                <span className="text-foreground">{exercise.name}:</span> {line}
              </li>
            )),
          )}
        </ul>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button size="lg" className="h-12 flex-1 text-base" disabled={pending} onClick={start}>
          <Play className="size-4" aria-hidden /> Start {plan.label.toLowerCase()} day
        </Button>
        <div className="flex items-center justify-between gap-2">
          <ToggleGroup
            type="single"
            value={day ?? ""}
            onValueChange={(value) => router.replace(value ? `/training?day=${value}` : "/training", { scroll: false })}
            aria-label="Pick a different day"
          >
            {PROGRAMS[program].days.map((entry) => (
              <ToggleGroupItem key={entry.key} value={entry.key} size="sm">
                {entry.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button variant="ghost" size="icon-sm" onClick={() => setShowWhy((value) => !value)} aria-label="Why these exercises" aria-pressed={showWhy}>
            <Info className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
