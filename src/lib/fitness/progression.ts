import { isBodyweight, type ExerciseDef } from "./exercises";
import type { ResolvedSet } from "./history";
import type { LocalDate } from "@/lib/date";

/**
 * Load suggestions and personal records.
 *
 * Suggestions follow double progression, the standard way to grow without
 * guessing: stay at a weight and add reps until every set reaches the top of
 * the range, then add the smallest sensible increment and drop back to the
 * bottom of the range. They are suggestions — the session screen shows the
 * rule beside the number, and whatever is actually lifted is what counts.
 */

/** Estimated one-rep max (Epley). Comparable across rep counts. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/**
 * The number a PR is measured in: e1RM for loaded lifts, reps for bodyweight
 * ones, seconds for holds. A loaded lift done with no weight falls back to reps.
 */
export function performanceScore(
  def: ExerciseDef | null,
  set: Pick<ResolvedSet, "reps" | "weightKg" | "durationSeconds">,
): { kind: "e1rm" | "reps" | "time"; value: number } | null {
  if (def?.measure === "time") {
    return set.durationSeconds ? { kind: "time", value: set.durationSeconds } : null;
  }
  if (set.weightKg && set.weightKg > 0 && set.reps && set.reps > 0 && !(def && isBodyweight(def))) {
    return { kind: "e1rm", value: estimatedOneRepMax(set.weightKg, set.reps) };
  }
  return set.reps && set.reps > 0 ? { kind: "reps", value: set.reps } : null;
}

export interface PersonalRecord {
  workoutId: string;
  date: LocalDate;
  identity: string;
  exerciseName: string;
  kind: "e1rm" | "reps" | "time";
  value: number;
  previous: number;
  /** The set that set it, for display: "62.5 kg × 6". */
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

/**
 * Every PR in history, oldest first. The first session of an exercise sets
 * the baseline rather than a record; after that, a session's best set is a
 * PR when it beats every earlier session. At most one per exercise per
 * session, so a good day is one record, not five.
 */
export function findPersonalRecords(sets: readonly ResolvedSet[]): PersonalRecord[] {
  const best = new Map<string, { kind: string; value: number }>();
  const records: PersonalRecord[] = [];

  // Group by workout in chronological order, then by exercise.
  const byWorkout = new Map<string, ResolvedSet[]>();
  for (const set of sets) {
    const list = byWorkout.get(set.workoutId) ?? [];
    list.push(set);
    byWorkout.set(set.workoutId, list);
  }

  for (const workoutSets of byWorkout.values()) {
    const top = new Map<string, { set: ResolvedSet; kind: "e1rm" | "reps" | "time"; value: number }>();
    for (const set of workoutSets) {
      const score = performanceScore(set.def, set);
      if (!score) continue;
      const current = top.get(set.identity);
      if (!current || score.value > current.value) top.set(set.identity, { set, ...score });
    }
    for (const [identity, entry] of top) {
      const previous = best.get(identity);
      if (previous && previous.kind === entry.kind && entry.value > previous.value + 1e-9) {
        records.push({
          workoutId: entry.set.workoutId,
          date: entry.set.date,
          identity,
          exerciseName: entry.set.def?.name ?? entry.set.exerciseName,
          kind: entry.kind,
          value: Math.round(entry.value * 10) / 10,
          previous: Math.round(previous.value * 10) / 10,
          weightKg: entry.set.weightKg,
          reps: entry.set.reps,
          durationSeconds: entry.set.durationSeconds,
        });
      }
      // A switch between loaded and bodyweight resets the baseline.
      if (!previous || previous.kind !== entry.kind || entry.value > previous.value) {
        best.set(identity, { kind: entry.kind, value: entry.value });
      }
    }
  }
  return records;
}

export interface SetTarget {
  reps: number | null;
  weightKg: number | null;
  seconds: number | null;
}

export interface Suggestion {
  sets: SetTarget[];
  /** One line explaining where the numbers came from. */
  rule: string;
}

const roundToPlate = (kg: number) => Math.round(kg * 4) / 4;

/**
 * Targets for the next session of an exercise from its last one.
 * `last` is that session's completed sets, in order.
 */
export function suggestSets(
  def: ExerciseDef,
  setCount: number,
  last: readonly Pick<ResolvedSet, "reps" | "weightKg" | "durationSeconds">[],
): Suggestion {
  const [low, high] = def.range;
  const repeat = (target: SetTarget) => Array.from({ length: setCount }, () => ({ ...target }));

  if (def.measure === "time") {
    const held = last.map((set) => set.durationSeconds ?? 0).filter((value) => value > 0);
    if (held.length === 0) return { sets: repeat({ reps: null, weightKg: null, seconds: low }), rule: `Start with ${low}s holds.` };
    const best = Math.max(...held);
    const seconds = held.every((value) => value >= high) ? best + 10 : Math.min(high, best + 5);
    return { sets: repeat({ reps: null, weightKg: null, seconds }), rule: `Last best ${best}s — hold a little longer.` };
  }

  const done = last.filter((set) => (set.reps ?? 0) > 0);
  const middle = Math.round((low + high) / 2);

  if (isBodyweight(def)) {
    if (done.length === 0) return { sets: repeat({ reps: middle, weightKg: null, seconds: null }), rule: `Aim for ${low}–${high} clean reps.` };
    const allTop = done.every((set) => (set.reps ?? 0) >= high);
    const sets = Array.from({ length: setCount }, (_, index) => {
      const previous = done[Math.min(index, done.length - 1)].reps ?? low;
      return { reps: allTop ? previous + 2 : Math.min(high, previous + 1), weightKg: null, seconds: null };
    });
    return { sets, rule: allTop ? "Every set hit the top of the range — keep adding reps." : "One more rep per set than last time." };
  }

  const loaded = done.filter((set) => (set.weightKg ?? 0) > 0);
  if (loaded.length === 0) {
    return {
      sets: repeat({ reps: middle, weightKg: null, seconds: null }),
      rule: `First time: pick a weight you could lift for ${high} with good form, and stop at ${middle}.`,
    };
  }

  const working = Math.max(...loaded.map((set) => set.weightKg ?? 0));
  const atWorking = loaded.filter((set) => set.weightKg === working);
  const allTop = atWorking.length >= Math.min(setCount, loaded.length) && atWorking.every((set) => (set.reps ?? 0) >= high);

  if (allTop) {
    const next = roundToPlate(working + def.increment);
    return {
      sets: repeat({ reps: low, weightKg: next, seconds: null }),
      rule: `Every set reached ${high} at ${working} kg — up to ${next} kg, back to ${low} reps.`,
    };
  }

  const sets = Array.from({ length: setCount }, (_, index) => {
    const previous = atWorking[Math.min(index, atWorking.length - 1)].reps ?? low;
    return { reps: Math.max(low, Math.min(high, previous + 1)), weightKg: working, seconds: null };
  });
  return { sets, rule: `Stay at ${working} kg and add a rep where you can; move up once every set hits ${high}.` };
}
