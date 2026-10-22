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
  /** Take this set as far as it goes (Greyskull's last set); `reps` is the minimum. */
  amrap?: boolean;
}

/** openGym's progression policies we offer for main lifts (AGPL, see NOTICE.md). */
export const PROGRESSION_SCHEMES = ["double", "linear", "greyskull"] as const;
export type ProgressionScheme = (typeof PROGRESSION_SCHEMES)[number];

export const PROGRESSION_LABELS: Record<ProgressionScheme, { name: string; summary: string }> = {
  double: {
    name: "Double progression",
    summary: "Work up through the rep range at one weight; every set at the top and the weight goes up.",
  },
  linear: {
    name: "Linear progression",
    summary: "Hit every rep in every set and the weight goes up next time. Three misses in a row and it backs off 10%.",
  },
  greyskull: {
    name: "Greyskull LP",
    summary: "Two sets of 5 and a last set to failure. Beat 5 and the weight goes up — twice as much at 10. One miss resets 10%.",
  },
};

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

/**
 * Lighter sets before a heavy one — openGym's warm-up ramp, reduced to what a
 * plan needs. Barbell lifts start on the empty bar; every rung is strictly
 * lighter than the last one up and snapped to the lift's own increment.
 * Bodyweight, timed and isolation work, and lifts without a known weight,
 * get none.
 */
export function warmupRamp(def: ExerciseDef, working: number | null): SetTarget[] {
  if (!def.compound || def.measure !== "reps" || isBodyweight(def) || !working || working < 20) return [];
  const bar = def.equipment.includes("barbell") ? 20 : 0;
  const step = def.increment > 0 ? def.increment : 2.5;
  const rungs: Array<[number, number]> = bar
    ? [[0, 10], [0.5, 8], [0.7, 5], [0.85, 3]]
    : [[0.5, 10], [0.75, 5]];
  const ramp: SetTarget[] = [];
  let previous = -1;
  for (const [share, reps] of rungs) {
    const weight = Math.max(bar, Math.floor((share === 0 ? bar : working * share) / step) * step);
    if (weight >= working || weight <= previous) continue;
    ramp.push({ reps, weightKg: roundToPlate(weight), seconds: null });
    previous = weight;
  }
  return ramp;
}

// --- Schemes for main lifts -------------------------------------------------

type Done = Pick<ResolvedSet, "reps" | "weightKg" | "durationSeconds">;

/** Main loaded lifts follow the chosen scheme; accessories and bodyweight stay on double. */
export function usesScheme(def: ExerciseDef, scheme: ProgressionScheme): boolean {
  return scheme !== "double" && def.compound && def.measure === "reps" && !isBodyweight(def);
}

export const DELOAD_FACTOR = 0.9;
/** Linear backs off after this many sessions in a row short of the target; Greyskull after one. */
export const LINEAR_MISSES_BEFORE_DELOAD = 3;
export const GREYSKULL_REPS = 5;
export const GREYSKULL_SETS = 3;

function workingWeight(sets: readonly Done[]): number | null {
  const loaded = sets.map((set) => set.weightKg ?? 0).filter((weight) => weight > 0);
  return loaded.length > 0 ? Math.max(...loaded) : null;
}

function deload(weight: number, def: ExerciseDef): number {
  const step = def.increment > 0 ? def.increment : 2.5;
  return roundToPlate(Math.max(step, Math.floor((weight * DELOAD_FACTOR) / step) * step));
}

/**
 * The next targets for an exercise under a scheme, from its past sessions
 * (completed work sets, oldest first). Sessions are read honestly, as openGym
 * does: fewer reps than the target, or fewer sets than prescribed, is a miss.
 */
export function suggestFor(
  def: ExerciseDef,
  scheme: ProgressionScheme,
  setCount: number,
  sessions: ReadonlyArray<readonly Done[]>,
): Suggestion {
  const last = sessions.at(-1) ?? [];
  if (!usesScheme(def, scheme)) return suggestSets(def, setCount, last);
  return scheme === "linear" ? linear(def, setCount, sessions) : greyskull(def, sessions);
}

function linear(def: ExerciseDef, setCount: number, sessions: ReadonlyArray<readonly Done[]>): Suggestion {
  const target = def.range[0];
  const repeat = (weightKg: number | null) => Array.from({ length: setCount }, () => ({ reps: target, weightKg, seconds: null }));
  const last = sessions.at(-1);
  const weight = last ? workingWeight(last) : null;
  if (!last || weight === null) {
    return { sets: repeat(null), rule: `First time: a weight you can lift for ${setCount} sets of ${target}.` };
  }
  const hit = (session: readonly Done[]) => {
    const at = session.filter((set) => set.weightKg === workingWeight(session));
    return at.length >= setCount && at.every((set) => (set.reps ?? 0) >= target);
  };
  if (hit(last)) {
    const next = roundToPlate(weight + def.increment);
    return { sets: repeat(next), rule: `Every set got ${target} at ${weight} kg — up to ${next} kg.` };
  }
  let misses = 0;
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    if (workingWeight(sessions[index]) !== weight || hit(sessions[index])) break;
    misses += 1;
  }
  if (misses >= LINEAR_MISSES_BEFORE_DELOAD) {
    const back = deload(weight, def);
    return { sets: repeat(back), rule: `${misses} sessions short at ${weight} kg — back off 10% to ${back} kg and build again.` };
  }
  return {
    sets: repeat(weight),
    rule: `Stay at ${weight} kg until every set gets ${target}. ${misses} of ${LINEAR_MISSES_BEFORE_DELOAD} misses before a back-off.`,
  };
}

function greyskull(def: ExerciseDef, sessions: ReadonlyArray<readonly Done[]>): Suggestion {
  const reps = GREYSKULL_REPS;
  const make = (weightKg: number | null): SetTarget[] => [
    { reps, weightKg, seconds: null },
    { reps, weightKg, seconds: null },
    { reps, weightKg, seconds: null, amrap: true },
  ];
  const last = sessions.at(-1);
  const weight = last ? workingWeight(last) : null;
  if (!last || weight === null) {
    return { sets: make(null), rule: "First time: two sets of 5 and a last set to failure, at a weight you could lift about 8 times." };
  }
  const at = last.filter((set) => set.weightKg === weight);
  const final = at.at(-1)?.reps ?? 0;
  if (at.length < GREYSKULL_SETS || at.some((set) => (set.reps ?? 0) < reps)) {
    const back = deload(weight, def);
    return { sets: make(back), rule: `Missed a set at ${weight} kg — reset 10% to ${back} kg.` };
  }
  const doubled = final >= reps * 2;
  const next = roundToPlate(weight + def.increment * (doubled ? 2 : 1));
  return {
    sets: make(next),
    rule: doubled
      ? `${final} reps on the last set — a double jump to ${next} kg.`
      : `Beat 5 on the last set (${final}) — up to ${next} kg.`,
  };
}
