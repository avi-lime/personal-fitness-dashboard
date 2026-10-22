import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workoutExercises, workoutSets, workouts } from "@/db/schema";
import { localDayBounds } from "@/lib/date";
import { resolveFully } from "@/lib/fitness/catalogue";
import { parseWorkoutCSV, type ImportedWorkout } from "@/lib/fitness/import-csv";

export interface ImportSummary {
  source: string | null;
  workouts: number;
  /** Sessions that will be (or were) added. */
  added: number;
  /** Sessions on days that already had a workout, left alone. */
  skippedDays: number;
  sets: number;
  warmups: number;
  skippedRows: number;
  cardioSkipped: number;
  convertedFromLb: boolean;
  exercises: number;
  /** Exercises we could place on muscles, by library or catalogue. */
  recognised: number;
  unrecognised: string[];
  from: string | null;
  to: string | null;
}

export type ImportResult = { ok: true; summary: ImportSummary } | { ok: false; error: string };

const ERRORS = {
  empty: "That file has no rows.",
  unrecognised: "That doesn't look like a workout export: it needs a date column and an exercise column.",
};

/**
 * Brings another app's history in. Days that already have a workout here are
 * left alone (openGym's rule), so importing the same file twice never
 * duplicates anything. With `commit: false` it only reports what it would do.
 */
export async function importHistory(
  userId: string,
  timezone: string,
  text: string,
  unit: "kg" | "lb",
  commit: boolean,
): Promise<ImportResult> {
  const parsed = parseWorkoutCSV(text, unit);
  if (!parsed.ok) return { ok: false, error: ERRORS[parsed.error] };

  const existing = new Set(
    (await db.selectDistinct({ date: workouts.localDate }).from(workouts).where(eq(workouts.userId, userId))).map(
      (row) => row.date,
    ),
  );
  const fresh = parsed.workouts.filter((workout) => !existing.has(workout.date));
  const placed = parsed.names.filter((name) => resolveFully({ name }).primary.length > 0);
  const summary: ImportSummary = {
    source: parsed.source,
    workouts: parsed.workouts.length,
    added: fresh.length,
    skippedDays: parsed.workouts.length - fresh.length,
    sets: parsed.sets,
    warmups: parsed.warmups,
    skippedRows: parsed.skipped,
    cardioSkipped: parsed.cardioSkipped,
    convertedFromLb: parsed.convertedFromLb,
    exercises: parsed.names.length,
    recognised: placed.length,
    unrecognised: parsed.names.filter((name) => !placed.includes(name)).slice(0, 20),
    from: parsed.workouts[0]?.date ?? null,
    to: parsed.workouts.at(-1)?.date ?? null,
  };
  if (commit && fresh.length > 0) await write(userId, timezone, fresh);
  return { ok: true, summary };
}

async function write(userId: string, timezone: string, list: ImportedWorkout[]) {
  await db.transaction(async (tx) => {
    for (const workout of list) {
      const midnight = localDayBounds(workout.date, timezone).start.getTime();
      // No time in the file: the evening, which is when most people train.
      const startedAt = new Date(midnight + (workout.startMs ?? 18 * 3_600_000));
      const endedAt = workout.endMs !== null && workout.endMs > (workout.startMs ?? 0) ? new Date(midnight + workout.endMs) : startedAt;
      const [created] = await tx
        .insert(workouts)
        .values({
          userId,
          name: workout.name,
          localDate: workout.date,
          notes: workout.notes,
          createdAt: startedAt,
          completedAt: endedAt,
          source: "import",
        })
        .returning({ id: workouts.id });

      for (const [index, exercise] of workout.exercises.entries()) {
        const [row] = await tx
          .insert(workoutExercises)
          .values({
            workoutId: created.id,
            name: exercise.name,
            exerciseKey: exercise.exerciseKey,
            supersetGroup: exercise.supersetGroup,
            sortOrder: index,
          })
          .returning({ id: workoutExercises.id });
        if (exercise.sets.length === 0) continue;
        await tx.insert(workoutSets).values(
          exercise.sets.map((set, position) => ({
            exerciseId: row.id,
            sortOrder: position,
            reps: set.reps,
            weightKg: set.weightKg,
            durationSeconds: set.durationSeconds,
            rpe: set.rpe,
            phase: set.phase,
            drops: set.drops,
            completed: true,
          })),
        );
      }
    }
  });
}
