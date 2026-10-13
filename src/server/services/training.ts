import "server-only";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { rpgLedger, trainingSettings, workoutExercises, workoutSets, workouts } from "@/db/schema";
import type { EntrySource } from "@/lib/domain";
import { localDayBounds, startOfWeek, toLocalDate, type LocalDate } from "@/lib/date";
import {
  exerciseByKey,
  matchExercise,
  normaliseExerciseName,
  resolveExercise,
  type EquipmentSetup,
} from "@/lib/fitness/exercises";
import { resolveSets, type SetRecord } from "@/lib/fitness/history";
import { MUSCLES } from "@/lib/fitness/muscles";
import { findPersonalRecords, suggestSets, type PersonalRecord } from "@/lib/fitness/progression";
import { planWorkout, type PlannedWorkout } from "@/lib/fitness/planner";
import { PROGRAMS, isDayKey, type DayKey, type ProgramKey } from "@/lib/fitness/programs";
import { attentionList, computeMuscleStatus, restList, type MuscleStatus } from "@/lib/fitness/status";
import { achievementXp, computeAchievements, type Achievement } from "@/lib/rpg/achievements";
import { claimId, computeMissions, type Mission } from "@/lib/rpg/missions";
import {
  levelFromXp,
  muscleLevelFromXp,
  muscleXp,
  summariseSessions,
  titleFor,
  trainingXp,
  XP_PER_PR,
  XP_PER_SET,
  type LevelProgress,
  type SessionSummary,
} from "@/lib/rpg/xp";
import { loadDayFacts } from "./day";
import { listGoals, toGoalLike } from "./goals";
import { getWorkout, listWorkoutsForDate, type WorkoutView } from "./workouts";

/**
 * Training, muscles and the game layer, all computed from one read of the
 * user's completed sets. Nothing here caches a number: recovery, levels,
 * PRs and mission progress are recomputed from history on every call.
 */

// --- Settings --------------------------------------------------------------

export interface TrainingPreferences {
  program: ProgramKey;
  equipment: EquipmentSetup;
  daysPerWeek: number;
  /** False until the user has saved their own choices. */
  configured: boolean;
}

export const DEFAULT_PREFERENCES: TrainingPreferences = {
  program: "ppl",
  equipment: "gym",
  daysPerWeek: 4,
  configured: false,
};

export async function getTrainingPreferences(userId: string): Promise<TrainingPreferences> {
  const [row] = await db.select().from(trainingSettings).where(eq(trainingSettings.userId, userId)).limit(1);
  if (!row) return DEFAULT_PREFERENCES;
  return { program: row.program, equipment: row.equipment, daysPerWeek: row.daysPerWeek, configured: true };
}

export async function saveTrainingPreferences(
  userId: string,
  input: Omit<TrainingPreferences, "configured">,
): Promise<TrainingPreferences> {
  await db
    .insert(trainingSettings)
    .values({ userId, ...input })
    .onConflictDoUpdate({ target: trainingSettings.userId, set: input });
  return { ...input, configured: true };
}

// --- History ---------------------------------------------------------------

/**
 * When a session happened. The completion time if it was finished, else when
 * it was started — unless that is nowhere near the workout's own date (a
 * session logged after the fact), in which case midday of that date.
 */
function trainedAt(row: { localDate: LocalDate; completedAt: Date | null; createdAt: Date }): Date {
  const noon = new Date(`${row.localDate}T12:00:00Z`);
  const stamp = row.completedAt ?? row.createdAt;
  return Math.abs(stamp.getTime() - noon.getTime()) > 36 * 3_600_000 ? noon : stamp;
}

/** Every completed set the user has ever logged, flattened. */
export async function loadSetRecords(userId: string): Promise<SetRecord[]> {
  const rows = await db
    .select({
      workoutId: workouts.id,
      workoutName: workouts.name,
      localDate: workouts.localDate,
      completedAt: workouts.completedAt,
      createdAt: workouts.createdAt,
      exerciseKey: workoutExercises.exerciseKey,
      exerciseName: workoutExercises.name,
      muscleGroup: workoutExercises.muscleGroup,
      exerciseOrder: workoutExercises.sortOrder,
      setOrder: workoutSets.sortOrder,
      reps: workoutSets.reps,
      weightKg: workoutSets.weightKg,
      durationSeconds: workoutSets.durationSeconds,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workouts.userId, userId), eq(workoutSets.completed, true)))
    .orderBy(asc(workouts.localDate), asc(workoutExercises.sortOrder), asc(workoutSets.sortOrder));

  return rows.map((row) => ({
    workoutId: row.workoutId,
    workoutName: row.workoutName,
    date: row.localDate,
    trainedAt: trainedAt(row),
    workoutCompleted: row.completedAt !== null,
    exerciseKey: row.exerciseKey,
    exerciseName: row.exerciseName,
    muscleGroup: row.muscleGroup,
    exerciseOrder: row.exerciseOrder,
    setOrder: row.setOrder,
    reps: row.reps,
    weightKg: row.weightKg,
    durationSeconds: row.durationSeconds,
  }));
}

/** The program day of the latest session that followed the program and did some work. */
async function lastProgramDay(userId: string, excludeWorkoutId?: string): Promise<DayKey | null> {
  const rows = await db
    .select({ id: workouts.id, day: workouts.programDay })
    .from(workouts)
    .where(
      and(
        eq(workouts.userId, userId),
        isNotNull(workouts.programDay),
        sql`exists (select 1 from ${workoutExercises} e join ${workoutSets} s on s.exercise_id = e.id
                    where e.workout_id = ${workouts.id} and s.completed)`,
      ),
    )
    .orderBy(desc(workouts.localDate), desc(workouts.createdAt))
    .limit(2);
  const row = rows.find((entry) => entry.id !== excludeWorkoutId);
  return row && isDayKey(row.day) ? row.day : null;
}

/** Today's unfinished session, newest first. */
export async function getActiveWorkout(userId: string, today: LocalDate): Promise<WorkoutView | null> {
  const day = await listWorkoutsForDate(userId, today);
  return day.filter((workout) => workout.completedAt === null).at(-1) ?? null;
}

// --- Snapshot --------------------------------------------------------------

export interface MuscleView extends MuscleStatus {
  level: LevelProgress;
}

export interface RpgView {
  level: LevelProgress;
  title: string;
  xp: { training: number; achievements: number; missions: number; total: number };
  gold: number;
  achievements: Achievement[];
  missions: Mission[];
}

export interface TrainingSnapshot {
  today: LocalDate;
  preferences: TrainingPreferences;
  muscles: MuscleView[];
  attention: MuscleStatus[];
  rest: MuscleStatus[];
  plan: PlannedWorkout;
  active: WorkoutView | null;
  sessions: SessionSummary[];
  prs: PersonalRecord[];
  rpg: RpgView;
}

async function ledgerTotals(userId: string) {
  const rows = await db
    .select({ kind: rpgLedger.kind, key: rpgLedger.key, period: rpgLedger.period, xp: rpgLedger.xp, gold: rpgLedger.gold })
    .from(rpgLedger)
    .where(eq(rpgLedger.userId, userId));
  return {
    claimed: new Set(rows.filter((row) => row.kind === "mission").map((row) => claimId(row.key, row.period))),
    xp: rows.reduce((total, row) => total + row.xp, 0),
    gold: rows.reduce((total, row) => total + row.gold, 0),
  };
}

export async function getTrainingSnapshot(
  userId: string,
  timezone: string,
  options: { day?: DayKey | null; now?: Date } = {},
): Promise<TrainingSnapshot> {
  const now = options.now ?? new Date();
  const today = toLocalDate(now, timezone);
  const week = startOfWeek(today);

  const [preferences, records, active, ledger, facts, goals] = await Promise.all([
    getTrainingPreferences(userId),
    loadSetRecords(userId),
    getActiveWorkout(userId, today),
    ledgerTotals(userId),
    loadDayFacts(userId, today, today),
    listGoals(userId, false),
  ]);

  const sets = resolveSets(records);
  const statuses = computeMuscleStatus(sets, today, now);
  const prs = findPersonalRecords(sets);
  const sessions = summariseSessions(sets, prs);
  const lastDay = await lastProgramDay(userId, active?.id);

  const plan = planWorkout({
    program: PROGRAMS[preferences.program],
    setup: preferences.equipment,
    lastDay,
    day: options.day,
    statuses,
    history: sets,
  });

  // Missions read the state as it was when their period began, so what they
  // ask does not shift while you train.
  const before = (date: LocalDate) => sets.filter((set) => set.date < date);
  const dayFacts = facts.get(today);
  const proteinTarget =
    goals.map(toGoalLike).find((goal) => goal.metricKey === "protein" && goal.period === "daily")?.targetValue ?? null;
  const missions = computeMissions({
    today,
    daysPerWeek: preferences.daysPerWeek,
    sets,
    sessions,
    prs,
    statusesAtDayStart: computeMuscleStatus(before(today), today, localDayBounds(today, timezone).start),
    statusesAtWeekStart: computeMuscleStatus(before(week), week, localDayBounds(week, timezone).start),
    protein: dayFacts?.protein ?? 0,
    proteinTarget,
    sleepHours: dayFacts?.sleepHours ?? 0,
    claimed: ledger.claimed,
  });

  const achievements = computeAchievements({ sets, sessions, prs });
  const training = trainingXp(sessions).total;
  const fromAchievements = achievementXp(achievements);
  const total = training + fromAchievements + ledger.xp;
  const level = levelFromXp(total);
  const perMuscle = muscleXp(sets);

  return {
    today,
    preferences,
    muscles: statuses.map((status) => ({ ...status, level: muscleLevelFromXp(perMuscle[status.muscle]) })),
    attention: attentionList(statuses),
    rest: restList(statuses),
    plan,
    active,
    sessions: sessions.slice(-30).reverse(),
    prs: prs.slice(-20).reverse(),
    rpg: {
      level,
      title: titleFor(level.level),
      xp: { training, achievements: fromAchievements, missions: ledger.xp, total },
      gold: ledger.gold,
      achievements,
      missions,
    },
  };
}

// --- Starting a planned session --------------------------------------------

/**
 * Turns the plan into a workout with every set pre-filled with its target.
 * If today's session for the program is already open, that one comes back
 * instead — pressing Start twice resumes rather than duplicates.
 */
export async function startPlannedWorkout(
  userId: string,
  timezone: string,
  options: { day?: DayKey | null } = {},
  source: EntrySource = "web",
): Promise<{ workout: WorkoutView; resumed: boolean; plan: PlannedWorkout | null }> {
  const today = toLocalDate(new Date(), timezone);
  const active = await getActiveWorkout(userId, today);
  if (active) return { workout: active, resumed: true, plan: null };

  const snapshot = await getTrainingSnapshot(userId, timezone, { day: options.day });
  const { plan } = snapshot;

  const workoutId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(workouts)
      .values({ userId, name: `${plan.label} day`, programDay: plan.day, localDate: today, source })
      .returning({ id: workouts.id });

    for (const [index, exercise] of plan.exercises.entries()) {
      const [row] = await tx
        .insert(workoutExercises)
        .values({ workoutId: created.id, name: exercise.name, exerciseKey: exercise.key, sortOrder: index })
        .returning({ id: workoutExercises.id });
      await tx.insert(workoutSets).values(
        exercise.sets.map((target, position) => ({
          exerciseId: row.id,
          sortOrder: position,
          reps: target.reps,
          weightKg: target.weightKg,
          durationSeconds: target.seconds,
          completed: false,
        })),
      );
    }
    return created.id;
  });

  const workout = await getWorkout(userId, workoutId);
  if (!workout) throw new Error("Workout could not be created");
  return { workout, resumed: false, plan };
}

// --- Completing sets -------------------------------------------------------

export interface SetResult {
  workoutId: string;
  exerciseId: string;
  setId: string;
  exerciseName: string;
  setNumber: number;
  xp: number;
  pr: PersonalRecord | null;
}

/** A PR set by this set, if its score is now the session's best and beats history. */
async function prFor(userId: string, workoutId: string, identity: string): Promise<PersonalRecord | null> {
  const sets = resolveSets(await loadSetRecords(userId));
  return findPersonalRecords(sets).find((record) => record.workoutId === workoutId && record.identity === identity) ?? null;
}

function identityOf(exercise: { exerciseKey: string | null; name: string }): string {
  const def = exerciseByKey(exercise.exerciseKey) ?? matchExercise(exercise.name);
  return def?.key ?? `custom:${exercise.name.trim().toLowerCase()}`;
}

/**
 * Marks one set done with what was actually lifted and reports what it
 * earned. A PR only counts once per exercise per session, so the XP for it is
 * reported on the set that first made it.
 */
export async function completeSet(
  userId: string,
  setId: string,
  values: { reps?: number | null; weightKg?: number | null; durationSeconds?: number | null },
): Promise<SetResult | null> {
  const [row] = await db
    .select({
      setId: workoutSets.id,
      sortOrder: workoutSets.sortOrder,
      exerciseId: workoutExercises.id,
      exerciseKey: workoutExercises.exerciseKey,
      exerciseName: workoutExercises.name,
      workoutId: workouts.id,
    })
    .from(workoutSets)
    .innerJoin(workoutExercises, eq(workoutExercises.id, workoutSets.exerciseId))
    .innerJoin(workouts, eq(workouts.id, workoutExercises.workoutId))
    .where(and(eq(workoutSets.id, setId), eq(workouts.userId, userId)));
  if (!row) return null;

  const identity = identityOf({ exerciseKey: row.exerciseKey, name: row.exerciseName });
  const before = await prFor(userId, row.workoutId, identity);

  const patch: Partial<typeof workoutSets.$inferInsert> = { completed: true };
  if (values.reps !== undefined) patch.reps = values.reps;
  if (values.weightKg !== undefined) patch.weightKg = values.weightKg;
  if (values.durationSeconds !== undefined) patch.durationSeconds = values.durationSeconds;
  await db.update(workoutSets).set(patch).where(eq(workoutSets.id, setId));

  const after = await prFor(userId, row.workoutId, identity);
  const isNewPr = after !== null && (before === null || after.value > before.value);
  return {
    workoutId: row.workoutId,
    exerciseId: row.exerciseId,
    setId,
    exerciseName: row.exerciseName,
    setNumber: row.sortOrder + 1,
    xp: XP_PER_SET + (isNewPr && before === null ? XP_PER_PR : 0),
    pr: isNewPr ? after : null,
  };
}

/**
 * "Bench 60 × 8" from a conversation: finds (or opens) today's session, finds
 * (or adds) the exercise, fills its next open set, and completes it.
 */
export async function logSet(
  userId: string,
  timezone: string,
  input: { exercise: string; reps?: number | null; weightKg?: number | null; seconds?: number | null; workoutId?: string | null },
  source: EntrySource = "web",
): Promise<SetResult & { workoutCreated: boolean }> {
  const today = toLocalDate(new Date(), timezone);
  let workoutCreated = false;

  let workoutId = input.workoutId ?? null;
  if (workoutId) {
    const owned = await getWorkout(userId, workoutId);
    if (!owned) throw new Error("Workout not found");
  } else {
    workoutId = (await getActiveWorkout(userId, today))?.id ?? null;
  }
  if (!workoutId) {
    const [created] = await db
      .insert(workouts)
      .values({ userId, name: "Training", localDate: today, source })
      .returning({ id: workouts.id });
    workoutId = created.id;
    workoutCreated = true;
  }

  const def = matchExercise(input.exercise);
  const wanted = def?.key ?? null;
  const typed = normaliseExerciseName(input.exercise);
  const exercises = await db
    .select()
    .from(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId))
    .orderBy(asc(workoutExercises.sortOrder));
  let exercise = exercises.find(
    (entry) =>
      (wanted && (entry.exerciseKey === wanted || matchExercise(entry.name)?.key === wanted)) ||
      normaliseExerciseName(entry.name) === typed,
  );
  if (!exercise) {
    [exercise] = await db
      .insert(workoutExercises)
      .values({
        workoutId,
        name: def?.name ?? input.exercise.trim(),
        exerciseKey: wanted,
        sortOrder: exercises.length,
      })
      .returning();
  }

  const [open] = await db
    .select({ id: workoutSets.id })
    .from(workoutSets)
    .where(and(eq(workoutSets.exerciseId, exercise.id), eq(workoutSets.completed, false)))
    .orderBy(asc(workoutSets.sortOrder))
    .limit(1);
  let setId = open?.id;
  if (!setId) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workoutSets)
      .where(eq(workoutSets.exerciseId, exercise.id));
    [{ id: setId }] = await db
      .insert(workoutSets)
      .values({ exerciseId: exercise.id, sortOrder: count, completed: false })
      .returning({ id: workoutSets.id });
  }

  const result = await completeSet(userId, setId, {
    reps: input.reps ?? null,
    weightKg: input.weightKg ?? null,
    durationSeconds: input.seconds ?? null,
  });
  if (!result) throw new Error("Set could not be logged");
  return { ...result, workoutCreated };
}

/** Everything a finished session earned, for the summary screen. */
export async function sessionReport(userId: string, workoutId: string) {
  const sets = resolveSets(await loadSetRecords(userId));
  const prs = findPersonalRecords(sets).filter((record) => record.workoutId === workoutId);
  const session = summariseSessions(sets, findPersonalRecords(sets)).find((entry) => entry.workoutId === workoutId);
  const own = sets.filter((set) => set.workoutId === workoutId);
  const muscles = MUSCLES.filter((muscle) => own.some((set) => set.primary.includes(muscle)));
  return { session: session ?? null, prs, muscles };
}

export function scoreLabel(record: PersonalRecord): string {
  if (record.kind === "time") return `${record.durationSeconds}s`;
  if (record.kind === "reps") return `${record.reps} reps`;
  return `${record.weightKg} kg × ${record.reps}`;
}

// --- The session screen ----------------------------------------------------

export interface SessionExerciseMeta {
  exerciseId: string;
  key: string | null;
  measure: "reps" | "time";
  range: [number, number] | null;
  restSeconds: number;
  /** kg per tap of the weight stepper. */
  step: number;
  primary: string[];
  rule: string | null;
  last: { date: LocalDate; sets: Array<{ reps: number | null; weightKg: number | null; durationSeconds: number | null }> } | null;
}

/**
 * What the session screen needs beside the workout itself: rest time, rep
 * range and the last time each exercise was done — matched by what the
 * exercise *is*, so an old "Bench" and a new "Bench press" count as one.
 */
export async function sessionMeta(userId: string, workout: WorkoutView): Promise<SessionExerciseMeta[]> {
  const history = resolveSets(await loadSetRecords(userId)).filter((set) => set.workoutId !== workout.id);
  const last = new Map<string, { workoutId: string; date: LocalDate; sets: typeof history }>();
  for (const set of history) {
    if (set.date > workout.date) continue;
    const entry = last.get(set.identity);
    if (!entry || entry.workoutId !== set.workoutId) last.set(set.identity, { workoutId: set.workoutId, date: set.date, sets: [set] });
    else entry.sets.push(set);
  }

  return workout.exercises.map((exercise) => {
    const resolved = resolveExercise({ exerciseKey: exercise.exerciseKey, name: exercise.name, muscleGroup: exercise.muscleGroup });
    const def = resolved.def;
    const identity = def?.key ?? `custom:${exercise.name.trim().toLowerCase()}`;
    const previous = last.get(identity) ?? null;
    return {
      exerciseId: exercise.id,
      key: def?.key ?? null,
      measure: def?.measure ?? "reps",
      range: def?.range ?? null,
      restSeconds: def?.restSeconds ?? 90,
      step: def && def.increment > 0 ? def.increment : 2.5,
      primary: resolved.primary,
      rule: def ? suggestSets(def, Math.max(1, exercise.sets.length), previous?.sets ?? []).rule : null,
      last: previous
        ? {
            date: previous.date,
            sets: previous.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg, durationSeconds: set.durationSeconds })),
          }
        : null,
    };
  });
}
