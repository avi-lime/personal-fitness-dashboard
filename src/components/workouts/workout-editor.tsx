"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/common/field";
import { ConfirmButton } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { SetRow } from "@/components/workouts/set-row";
import {
  addExerciseAction,
  addSetAction,
  deleteExerciseAction,
  deleteWorkoutAction,
  saveWorkoutTemplateAction,
  setWorkoutCompletionAction,
  updateWorkoutAction,
} from "@/server/actions/workouts";
import { formatValue } from "@/lib/format";
import { formatShortDate } from "@/lib/date";
import type { PreviousPerformance, WorkoutView } from "@/server/services/workouts";

export function WorkoutEditor({
  workout,
  previousByExercise,
}: {
  workout: WorkoutView;
  previousByExercise: Record<string, PreviousPerformance | null>;
}) {
  const [exerciseName, setExerciseName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState(workout.name);
  const { pending, run } = useAction();
  const router = useRouter();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display flex flex-wrap items-center gap-3 text-3xl">
            {workout.name}
            <Badge variant={workout.completedAt ? "secondary" : "outline"}>
              {workout.completedAt ? "Completed" : "In progress"}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{workout.date}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={workout.completedAt ? "outline" : "default"}
            size="sm"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  setWorkoutCompletionAction({
                    workoutId: workout.id,
                    completed: !workout.completedAt,
                  }),
                { success: workout.completedAt ? "Marked in progress" : "Workout completed" },
              )
            }
          >
            {workout.completedAt ? "Reopen" : "Mark complete"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pending || workout.exercises.length === 0}
            onClick={() => setTemplateOpen(true)}
          >
            Save as template
          </Button>
          <ConfirmButton
            variant="ghost"
            size="sm"
            disabled={pending}
            title={`Delete "${workout.name}"?`}
            description="This cannot be undone."
            confirmLabel="Delete"
            onConfirm={() =>
              run(() => deleteWorkoutAction(workout.id), {
                success: "Workout deleted",
                onSuccess: () => router.push("/training"),
              })
            }
          >
            <Trash2 className="size-4" aria-hidden /> Delete
          </ConfirmButton>
          <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Save as template</DialogTitle>
                <DialogDescription>Exercises and set counts are reused; weights are not.</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(() => saveWorkoutTemplateAction({ workoutId: workout.id, name: templateName.trim() }), {
                    success: "Template saved",
                    onSuccess: () => setTemplateOpen(false),
                  });
                }}
              >
                <Field id="template-name" label="Template name">
                  <Input id="template-name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required autoFocus />
                </Field>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setTemplateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={pending || !templateName.trim()}>
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="gap-3 p-4">
        <label htmlFor="workout-notes" className="text-sm font-medium">
          Notes
        </label>
        <Textarea
          id="workout-notes"
          defaultValue={workout.notes ?? ""}
          rows={2}
          placeholder="How did it feel?"
          onBlur={(event) => {
            const notes = event.target.value.trim();
            if (notes !== (workout.notes ?? "")) {
              run(() => updateWorkoutAction({ workoutId: workout.id, notes: notes || null }));
            }
          }}
        />
      </Card>

      {workout.exercises.length === 0 ? (
        <EmptyState title="No exercises yet" description="Add your first exercise below." />
      ) : (
        <div className="space-y-4">
          {workout.exercises.map((exercise) => {
            const previous = previousByExercise[exercise.name.toLowerCase()] ?? null;
            return (
              <Card key={exercise.id} className="gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-medium">{exercise.name}</h2>
                    {exercise.muscleGroup ? (
                      <p className="text-xs text-muted-foreground">{exercise.muscleGroup}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="tabular text-xs text-muted-foreground">
                      {previous
                        ? `Last (${formatShortDate(previous.date)}): ${previous.sets
                            .map((set) =>
                              set.weightKg !== null
                                ? `${set.reps ?? 0}×${formatValue(set.weightKg)}`
                                : `${set.reps ?? 0}`,
                            )
                            .join(", ")}`
                        : "No previous session"}
                    </p>
                    <ConfirmButton
                      size="icon"
                      variant="ghost"
                      disabled={pending}
                      aria-label={`Delete ${exercise.name}`}
                      title={`Remove ${exercise.name}?`}
                      description="Its sets go with it."
                      confirmLabel="Remove"
                      onConfirm={() => run(() => deleteExerciseAction(exercise.id), { success: "Exercise removed" })}
                    >
                      <Trash2 className="size-4" />
                    </ConfirmButton>
                  </div>
                </div>

                <div className="grid grid-cols-[1.5rem_1fr_1fr_3rem_auto_auto] items-center gap-x-2 gap-y-1.5">
                  <span className="text-xs text-muted-foreground">Set</span>
                  <span className="text-xs text-muted-foreground">Reps</span>
                  <span className="text-xs text-muted-foreground">kg</span>
                  <span className="text-xs text-muted-foreground">RPE</span>
                  <span className="text-xs text-muted-foreground">Done</span>
                  <span />
                  {exercise.sets.map((set, index) => (
                    <SetRow key={set.id} set={set} index={index} />
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  className="self-start"
                  onClick={() => {
                    const last = exercise.sets[exercise.sets.length - 1];
                    run(
                      () =>
                        addSetAction({
                          exerciseId: exercise.id,
                          reps: last?.reps ?? null,
                          weightKg: last?.weightKg ?? null,
                          completed: false,
                        }),
                      { success: "Set added" },
                    );
                  }}
                >
                  <Plus className="size-3.5" aria-hidden /> Add set
                </Button>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="gap-3 p-4">
        <h2 className="text-sm font-medium">Add exercise</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () =>
                addExerciseAction({
                  workoutId: workout.id,
                  name: exerciseName.trim(),
                  muscleGroup: muscleGroup.trim() || null,
                }),
              {
                success: "Exercise added",
                onSuccess: () => {
                  setExerciseName("");
                  setMuscleGroup("");
                },
              },
            );
          }}
        >
          <Input
            value={exerciseName}
            onChange={(event) => setExerciseName(event.target.value)}
            placeholder="Bench press"
            aria-label="Exercise name"
            className="max-w-xs"
            required
          />
          <Input
            value={muscleGroup}
            onChange={(event) => setMuscleGroup(event.target.value)}
            placeholder="Chest (optional)"
            aria-label="Muscle group"
            className="max-w-xs"
          />
          <Button type="submit" disabled={pending || exerciseName.trim() === ""}>
            Add
          </Button>
        </form>
      </Card>
    </div>
  );
}
