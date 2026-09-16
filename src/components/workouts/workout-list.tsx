"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { useLogDialogs } from "@/components/log/log-provider";
import { deleteWorkoutTemplateAction } from "@/server/actions/workouts";
import { formatValue } from "@/lib/format";
import type { WorkoutView } from "@/server/services/workouts";

export interface TemplateView {
  id: string;
  name: string;
  exercises: Array<{ id: string; name: string; targetSets: number; targetReps: number }>;
}

export function WorkoutList({
  workouts,
  templates,
}: {
  workouts: WorkoutView[];
  templates: TemplateView[];
}) {
  const { open } = useLogDialogs();
  const { pending, run } = useAction();

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent workouts</h2>
          <Button size="sm" onClick={() => open("workout")}>
            Start workout
          </Button>
        </div>
        {workouts.length === 0 ? (
          <EmptyState title="No workouts yet." description="Start one from scratch or from a template." />
        ) : (
          <ul className="space-y-2">
            {workouts.map((workout) => {
              const totalSets = workout.exercises.reduce(
                (total, exercise) => total + exercise.sets.length,
                0,
              );
              const doneSets = workout.exercises.reduce(
                (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
                0,
              );
              const volume = workout.exercises.reduce(
                (total, exercise) =>
                  total +
                  exercise.sets
                    .filter((set) => set.completed)
                    .reduce((sum, set) => sum + (set.reps ?? 0) * (set.weightKg ?? 0), 0),
                0,
              );
              return (
                <li key={workout.id}>
                  <Card className="flex-row flex-wrap items-center gap-3 p-4">
                    <div className="min-w-40 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {workout.name}
                        <Badge variant={workout.completedAt ? "secondary" : "outline"}>
                          {workout.completedAt ? "Completed" : "In progress"}
                        </Badge>
                      </p>
                      <p className="tabular text-xs text-muted-foreground">
                        {workout.date} · {workout.exercises.length} exercises · {doneSets}/
                        {totalSets} sets · {formatValue(volume)} kg volume
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/training/${workout.id}`}>Open</Link>
                    </Button>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Templates</h2>
        {templates.length === 0 ? (
          <EmptyState
            title="No templates"
            description="Open a workout and choose “Save as template” to reuse it."
          />
        ) : (
          <ul className="space-y-2">
            {templates.map((template) => (
              <li key={template.id}>
                <Card className="gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium">{template.name}</h3>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      aria-label={`Delete template ${template.name}`}
                      onClick={() =>
                        run(() => deleteWorkoutTemplateAction(template.id), {
                          success: "Template deleted",
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <ul className="tabular space-y-0.5 text-xs text-muted-foreground">
                    {template.exercises.map((exercise) => (
                      <li key={exercise.id}>
                        {exercise.name} · {exercise.targetSets}×{exercise.targetReps}
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
