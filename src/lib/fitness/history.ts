import type { ExerciseDef } from "./exercises";
import { resolveFully } from "./catalogue";
import type { Muscle } from "./muscles";
import type { LocalDate } from "@/lib/date";

/**
 * One completed set, flattened out of workouts → exercises → sets.
 *
 * Only work sets: warm-ups are filtered out where the records are loaded, so
 * no XP, credit, record or progression can ever come from one.
 *
 * Every fitness and RPG calculation runs over a list of these, so nothing
 * about muscles, recovery, PRs or XP is ever stored: change or delete a set
 * and every number that depended on it changes with it.
 */
export interface SetRecord {
  workoutId: string;
  workoutName: string;
  date: LocalDate;
  /** When the session happened, as precisely as we know. */
  trainedAt: Date;
  /** Whether the session was marked complete. */
  workoutCompleted: boolean;
  exerciseKey: string | null;
  exerciseName: string;
  muscleGroup: string | null;
  /** Order of the exercise inside its workout. */
  exerciseOrder: number;
  setOrder: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  /** Drop-set extras: more volume, still one set. */
  drops?: Array<{ weightKg: number | null; reps: number | null }>;
}

export interface ResolvedSet extends SetRecord {
  def: ExerciseDef | null;
  /** Stable identity for "the same exercise": library key, else the typed name. */
  identity: string;
  primary: Muscle[];
  secondary: Muscle[];
}

/** Attaches the library entry and muscles to each set, oldest first. */
export function resolveSets(records: readonly SetRecord[]): ResolvedSet[] {
  return records
    .map((record) => {
      const resolved = resolveFully({
        exerciseKey: record.exerciseKey,
        name: record.exerciseName,
        muscleGroup: record.muscleGroup,
      });
      return {
        ...record,
        def: resolved.def,
        identity: resolved.identity,
        primary: resolved.primary,
        secondary: resolved.secondary,
      };
    })
    .sort(
      (a, b) =>
        a.trainedAt.getTime() - b.trainedAt.getTime() ||
        a.exerciseOrder - b.exerciseOrder ||
        a.setOrder - b.setOrder,
    );
}

/** Sets a muscle got from one set: 1 if it was the target, 0.5 if it helped. */
export function creditFor(set: Pick<ResolvedSet, "primary" | "secondary">, muscle: Muscle): number {
  if (set.primary.includes(muscle)) return 1;
  if (set.secondary.includes(muscle)) return 0.5;
  return 0;
}
