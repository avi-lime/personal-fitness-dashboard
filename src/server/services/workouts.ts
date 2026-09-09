import "server-only";
import { and, asc, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  workoutExercises,
  workoutSets,
  workoutTemplateExercises,
  workoutTemplates,
  workouts,
} from "@/db/schema";
import type { Workout } from "@/db/schema";
import type { EntrySource } from "@/lib/domain";
import { toLocalDate, type LocalDate } from "@/lib/date";
import { round } from "@/lib/goals";

export interface WorkoutSetView {
  id: string;
  sortOrder: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  rpe: number | null;
  completed: boolean;
}

export interface WorkoutExerciseView {
  id: string;
  name: string;
  muscleGroup: string | null;
  sortOrder: number;
  sets: WorkoutSetView[];
}

export interface WorkoutView {
  id: string;
  name: string;
  date: LocalDate;
  notes: string | null;
  completedAt: Date | null;
  exercises: WorkoutExerciseView[];
}

/** Total reps x weight for an exercise, the simplest progressive-overload signal. */
export function exerciseVolume(sets: WorkoutSetView[]): number {
  return round(
    sets
      .filter((set) => set.completed)
      .reduce((total, set) => total + (set.reps ?? 0) * (set.weightKg ?? 0), 0),
  );
}

export function bestSet(sets: WorkoutSetView[]): WorkoutSetView | null {
  const completed = sets.filter((set) => set.completed && set.weightKg !== null);
  if (completed.length === 0) return null;
  return completed.reduce((best, set) => ((set.weightKg ?? 0) > (best.weightKg ?? 0) ? set : best));
}

async function hydrate(rows: Workout[]): Promise<WorkoutView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const exercises = await db
    .select()
    .from(workoutExercises)
    .where(inArray(workoutExercises.workoutId, ids))
    .orderBy(asc(workoutExercises.sortOrder));
  const exerciseIds = exercises.map((exercise) => exercise.id);
  const sets =
    exerciseIds.length > 0
      ? await db
          .select()
          .from(workoutSets)
          .where(inArray(workoutSets.exerciseId, exerciseIds))
          .orderBy(asc(workoutSets.sortOrder))
      : [];

  const setsByExercise = new Map<string, WorkoutSetView[]>();
  for (const set of sets) {
    const list = setsByExercise.get(set.exerciseId) ?? [];
    list.push({
      id: set.id,
      sortOrder: set.sortOrder,
      reps: set.reps,
      weightKg: set.weightKg,
      durationSeconds: set.durationSeconds,
      rpe: set.rpe,
      completed: set.completed,
    });
    setsByExercise.set(set.exerciseId, list);
  }

  const exercisesByWorkout = new Map<string, WorkoutExerciseView[]>();
  for (const exercise of exercises) {
    const list = exercisesByWorkout.get(exercise.workoutId) ?? [];
    list.push({
      id: exercise.id,
      name: exercise.name,
      muscleGroup: exercise.muscleGroup,
      sortOrder: exercise.sortOrder,
      sets: setsByExercise.get(exercise.id) ?? [],
    });
    exercisesByWorkout.set(exercise.workoutId, list);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    date: row.localDate,
    notes: row.notes,
    completedAt: row.completedAt,
    exercises: exercisesByWorkout.get(row.id) ?? [],
  }));
}

export async function listWorkoutsForDate(
  userId: string,
  date: LocalDate,
): Promise<WorkoutView[]> {
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.userId, userId), eq(workouts.localDate, date)))
    .orderBy(asc(workouts.createdAt));
  return hydrate(rows);
}

export async function getWorkout(userId: string, workoutId: string): Promise<WorkoutView | null> {
  const rows = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)));
  const [view] = await hydrate(rows);
  return view ?? null;
}

export async function listRecentWorkouts(userId: string, limit = 20): Promise<WorkoutView[]> {
  const rows = await db
    .select()
    .from(workouts)
    .where(eq(workouts.userId, userId))
    .orderBy(desc(workouts.localDate), desc(workouts.createdAt))
    .limit(limit);
  return hydrate(rows);
}

export async function createWorkout(
  userId: string,
  timezone: string,
  input: { name: string; date?: LocalDate | null; notes?: string | null; templateId?: string | null },
  source: EntrySource = "web",
): Promise<WorkoutView> {
  const localDate = input.date ?? toLocalDate(new Date(), timezone);

  const workoutId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(workouts)
      .values({
        userId,
        name: input.name,
        localDate,
        notes: input.notes ?? null,
        templateId: input.templateId ?? null,
        source,
      })
      .returning({ id: workouts.id });

    if (input.templateId) {
      const template = await tx.query.workoutTemplates.findFirst({
        where: and(
          eq(workoutTemplates.id, input.templateId),
          eq(workoutTemplates.userId, userId),
        ),
        with: { exercises: { orderBy: [asc(workoutTemplateExercises.sortOrder)] } },
      });
      if (template) {
        for (const exercise of template.exercises) {
          const [insertedExercise] = await tx
            .insert(workoutExercises)
            .values({
              workoutId: created.id,
              name: exercise.name,
              muscleGroup: exercise.muscleGroup,
              sortOrder: exercise.sortOrder,
            })
            .returning({ id: workoutExercises.id });
          if (exercise.targetSets > 0) {
            await tx.insert(workoutSets).values(
              Array.from({ length: exercise.targetSets }, (_, index) => ({
                exerciseId: insertedExercise.id,
                sortOrder: index,
                reps: exercise.targetReps,
              })),
            );
          }
        }
      }
    }
    return created.id;
  });

  const view = await getWorkout(userId, workoutId);
  if (!view) throw new Error("Workout could not be created");
  return view;
}

export async function updateWorkout(
  userId: string,
  workoutId: string,
  patch: { name?: string; notes?: string | null; date?: LocalDate },
): Promise<boolean> {
  const changes: Partial<typeof workouts.$inferInsert> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.notes !== undefined) changes.notes = patch.notes;
  if (patch.date !== undefined) changes.localDate = patch.date;
  if (Object.keys(changes).length === 0) return false;
  const [updated] = await db
    .update(workouts)
    .set(changes)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .returning({ id: workouts.id });
  return Boolean(updated);
}

export async function setWorkoutCompletion(
  userId: string,
  workoutId: string,
  completed: boolean,
): Promise<boolean> {
  const [updated] = await db
    .update(workouts)
    .set({ completedAt: completed ? new Date() : null })
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .returning({ id: workouts.id });
  return Boolean(updated);
}

export async function deleteWorkout(userId: string, workoutId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .returning({ id: workouts.id });
  return Boolean(deleted);
}

async function assertOwnsWorkout(userId: string, workoutId: string): Promise<boolean> {
  const row = await db.query.workouts.findFirst({
    where: and(eq(workouts.id, workoutId), eq(workouts.userId, userId)),
    columns: { id: true },
  });
  return Boolean(row);
}

async function workoutIdForExercise(userId: string, exerciseId: string): Promise<string | null> {
  const [row] = await db
    .select({ workoutId: workoutExercises.workoutId })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workoutExercises.id, exerciseId), eq(workouts.userId, userId)));
  return row?.workoutId ?? null;
}

export async function addExercise(
  userId: string,
  workoutId: string,
  name: string,
  muscleGroup?: string | null,
): Promise<string | null> {
  if (!(await assertOwnsWorkout(userId, workoutId))) return null;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId));
  const [created] = await db
    .insert(workoutExercises)
    .values({ workoutId, name, muscleGroup: muscleGroup ?? null, sortOrder: count })
    .returning({ id: workoutExercises.id });
  return created.id;
}

export async function deleteExercise(userId: string, exerciseId: string): Promise<boolean> {
  if (!(await workoutIdForExercise(userId, exerciseId))) return false;
  await db.delete(workoutExercises).where(eq(workoutExercises.id, exerciseId));
  return true;
}

export async function addSet(
  userId: string,
  exerciseId: string,
  values: { reps?: number | null; weightKg?: number | null; durationSeconds?: number | null },
): Promise<string | null> {
  if (!(await workoutIdForExercise(userId, exerciseId))) return null;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workoutSets)
    .where(eq(workoutSets.exerciseId, exerciseId));
  const [created] = await db
    .insert(workoutSets)
    .values({
      exerciseId,
      sortOrder: count,
      reps: values.reps ?? null,
      weightKg: values.weightKg ?? null,
      durationSeconds: values.durationSeconds ?? null,
    })
    .returning({ id: workoutSets.id });
  return created.id;
}

export async function updateSet(
  userId: string,
  setId: string,
  patch: {
    reps?: number | null;
    weightKg?: number | null;
    durationSeconds?: number | null;
    rpe?: number | null;
    completed?: boolean;
  },
): Promise<boolean> {
  const [row] = await db
    .select({ id: workoutSets.id })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workoutSets.id, setId), eq(workouts.userId, userId)));
  if (!row) return false;
  await db.update(workoutSets).set(patch).where(eq(workoutSets.id, setId));
  return true;
}

export async function deleteSet(userId: string, setId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: workoutSets.id })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workoutSets.id, setId), eq(workouts.userId, userId)));
  if (!row) return false;
  await db.delete(workoutSets).where(eq(workoutSets.id, setId));
  return true;
}

export interface PreviousPerformance {
  workoutId: string;
  date: LocalDate;
  sets: WorkoutSetView[];
  volume: number;
  best: WorkoutSetView | null;
}

/**
 * The most recent earlier session that contains the same exercise name, so the
 * training card can show "last time" beside today's sets. It reports history —
 * it deliberately does not prescribe a weight.
 */
export async function previousPerformance(
  userId: string,
  exerciseName: string,
  beforeDate: LocalDate,
  excludeWorkoutId?: string,
): Promise<PreviousPerformance | null> {
  const rows = await db
    .select({ workoutId: workouts.id, date: workouts.localDate, exerciseId: workoutExercises.id })
    .from(workoutExercises)
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(
      and(
        eq(workouts.userId, userId),
        sql`lower(${workoutExercises.name}) = lower(${exerciseName})`,
        lt(workouts.localDate, beforeDate),
        excludeWorkoutId ? ne(workouts.id, excludeWorkoutId) : undefined,
      ),
    )
    .orderBy(desc(workouts.localDate))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const sets = await db
    .select()
    .from(workoutSets)
    .where(eq(workoutSets.exerciseId, row.exerciseId))
    .orderBy(asc(workoutSets.sortOrder));

  const views: WorkoutSetView[] = sets.map((set) => ({
    id: set.id,
    sortOrder: set.sortOrder,
    reps: set.reps,
    weightKg: set.weightKg,
    durationSeconds: set.durationSeconds,
    rpe: set.rpe,
    completed: set.completed,
  }));

  return {
    workoutId: row.workoutId,
    date: row.date,
    sets: views,
    volume: exerciseVolume(views),
    best: bestSet(views),
  };
}

// --- Templates -------------------------------------------------------------

export async function listWorkoutTemplates(userId: string) {
  return db.query.workoutTemplates.findMany({
    where: eq(workoutTemplates.userId, userId),
    with: { exercises: { orderBy: [asc(workoutTemplateExercises.sortOrder)] } },
    orderBy: [asc(workoutTemplates.name)],
  });
}

export async function saveWorkoutAsTemplate(
  userId: string,
  workoutId: string,
  name: string,
): Promise<string | null> {
  const workout = await getWorkout(userId, workoutId);
  if (!workout) return null;

  return db.transaction(async (tx) => {
    const [template] = await tx
      .insert(workoutTemplates)
      .values({ userId, name, notes: workout.notes })
      .onConflictDoUpdate({
        target: [workoutTemplates.userId, workoutTemplates.name],
        set: { notes: workout.notes },
      })
      .returning({ id: workoutTemplates.id });
    await tx
      .delete(workoutTemplateExercises)
      .where(eq(workoutTemplateExercises.templateId, template.id));
    if (workout.exercises.length > 0) {
      await tx.insert(workoutTemplateExercises).values(
        workout.exercises.map((exercise, index) => ({
          templateId: template.id,
          name: exercise.name,
          muscleGroup: exercise.muscleGroup,
          sortOrder: index,
          targetSets: Math.max(1, exercise.sets.length),
          targetReps: exercise.sets[0]?.reps ?? 10,
        })),
      );
    }
    return template.id;
  });
}

export async function deleteWorkoutTemplate(userId: string, templateId: string): Promise<boolean> {
  const [deleted] = await db
    .delete(workoutTemplates)
    .where(and(eq(workoutTemplates.id, templateId), eq(workoutTemplates.userId, userId)))
    .returning({ id: workoutTemplates.id });
  return Boolean(deleted);
}
