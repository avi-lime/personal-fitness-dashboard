import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { StartWorkoutButton } from "@/components/dashboard/start-workout-button";
import { formatValue } from "@/lib/format";
import { formatShortDate } from "@/lib/date";
import { exerciseVolume, type PreviousPerformance, type WorkoutView } from "@/server/services/workouts";

export interface TrainingCardData {
  workout: WorkoutView | null;
  previousByExercise: Record<string, PreviousPerformance | null>;
}

export function TrainingCard({ workout, previousByExercise }: TrainingCardData) {
  if (!workout) {
    return (
      <Card className="p-4">
        <h2 className="mb-3 text-sm font-medium">Training</h2>
        <EmptyState
          title="No workout logged today"
          description="Start one from a template or from scratch."
          action={<StartWorkoutButton />}
        />
      </Card>
    );
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">{workout.name}</h2>
          <Badge variant={workout.completedAt ? "secondary" : "outline"}>
            {workout.completedAt ? "Completed" : "In progress"}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/training/${workout.id}`}>Open</Link>
        </Button>
      </div>

      {workout.exercises.length === 0 ? (
        <p className="text-sm text-muted-foreground">No exercises added yet.</p>
      ) : (
        <ul className="divide-y">
          {workout.exercises.map((exercise) => {
            const previous = previousByExercise[exercise.name.toLowerCase()] ?? null;
            const volume = exerciseVolume(exercise.sets);
            const done = exercise.sets.filter((set) => set.completed).length;
            return (
              <li key={exercise.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                <span className="min-w-32 text-sm font-medium">{exercise.name}</span>
                <span className="tabular text-sm text-muted-foreground">
                  {done}/{exercise.sets.length} sets
                </span>
                <span className="tabular text-sm text-muted-foreground">
                  {exercise.sets
                    .map((set) =>
                      set.weightKg !== null
                        ? `${formatValue(set.reps ?? 0)}×${formatValue(set.weightKg)}`
                        : `${formatValue(set.reps ?? 0)} reps`,
                    )
                    .join(" · ")}
                </span>
                <span className="tabular ml-auto text-xs text-muted-foreground">
                  {previous ? (
                    <>
                      Last {formatShortDate(previous.date)}: {formatValue(previous.volume)} kg vol
                      {volume > 0 ? (
                        <span className={volume >= previous.volume ? "text-positive" : undefined}>
                          {" "}
                          → {formatValue(volume)}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "No previous session"
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
