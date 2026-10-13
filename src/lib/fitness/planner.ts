import { canDo, exerciseByKey, type EquipmentSetup, type ExerciseDef, type Measure } from "./exercises";
import type { ResolvedSet } from "./history";
import { MUSCLE_META, type Muscle } from "./muscles";
import { suggestSets, type SetTarget } from "./progression";
import { TOP_UP_EXERCISES, type DayKey, type Program, type ProgramDay } from "./programs";
import { attentionList, type MuscleStatus } from "./status";
import type { LocalDate } from "@/lib/date";

/**
 * Builds the next session: which day of the program, which exercise fills
 * each slot, how many sets, and what to aim for in each.
 *
 * "Best" here means four concrete things, each visible in the result so it
 * can be explained rather than trusted:
 *   1. The next day in the rotation — unless its muscles are still
 *      recovering and another day's are ready.
 *   2. The exercise the user has been doing for each slot, so progress
 *      carries over; otherwise the best one their equipment allows.
 *   3. One set fewer for a muscle still recovering, one more for a muscle
 *      that is behind this week.
 *   4. A short top-up for a small muscle that has been left out.
 * Weights and reps come from double progression on the last session.
 */

export interface PlannedExercise {
  key: string;
  name: string;
  slot: string;
  measure: Measure;
  range: [number, number];
  restSeconds: number;
  primary: Muscle[];
  secondary: Muscle[];
  sets: SetTarget[];
  /** Where the targets came from. */
  rule: string;
  /** Why the plan differs from the program's default here, if it does. */
  notes: string[];
  last: { date: LocalDate; sets: SetTarget[] } | null;
  topUp: boolean;
}

export interface PlannedWorkout {
  program: Program["key"];
  day: DayKey;
  label: string;
  /** One sentence on why this day. */
  reason: string;
  /** Every day's muscles are still recovering. */
  restSuggested: boolean;
  exercises: PlannedExercise[];
  estimatedMinutes: number;
  muscles: Muscle[];
}

export interface PlannerInput {
  program: Program;
  setup: EquipmentSetup;
  /** Program day of the most recent session that followed the program. */
  lastDay: DayKey | null;
  /** Ask for a particular day instead of the rotation. */
  day?: DayKey | null;
  statuses: readonly MuscleStatus[];
  /** Completed sets, oldest first. */
  history: readonly ResolvedSet[];
}

/** Share of a day's focus muscles that are recovered. */
function readiness(day: ProgramDay, statuses: ReadonlyMap<Muscle, MuscleStatus>): number {
  const ready = day.focus.filter((muscle) => statuses.get(muscle)?.state !== "recovering").length;
  return ready / day.focus.length;
}

function chooseDay(input: PlannerInput, statuses: ReadonlyMap<Muscle, MuscleStatus>) {
  const { days } = input.program;
  if (input.day) {
    const requested = days.find((day) => day.key === input.day);
    if (requested) return { day: requested, reason: `${requested.label} day, as asked.`, rest: false };
  }

  const lastIndex = input.lastDay ? days.findIndex((day) => day.key === input.lastDay) : -1;
  const next = days[(lastIndex + 1) % days.length];
  const afterWhat = lastIndex >= 0 ? `after ${days[lastIndex].label}` : "to start the rotation";

  if (readiness(next, statuses) >= 0.5) {
    return { day: next, reason: `${next.label} is next in the rotation, ${afterWhat}.`, rest: false };
  }
  // Ties go to whichever day comes soonest in the rotation, so the day just
  // trained is the last resort rather than the first.
  const nextIndex = days.indexOf(next);
  const alternative = days
    .filter((day) => day.key !== next.key)
    .map((day) => ({
      day,
      score: readiness(day, statuses),
      distance: (days.indexOf(day) - nextIndex + days.length) % days.length,
    }))
    .sort((a, b) => b.score - a.score || a.distance - b.distance)[0];
  if (alternative && alternative.score >= 0.75) {
    return {
      day: alternative.day,
      reason: `${next.label} muscles are still recovering, so ${alternative.day.label} goes first today.`,
      rest: false,
    };
  }
  return {
    day: next,
    reason: `Most of your muscles are still recovering — a rest day would serve you better. If you train anyway, ${next.label} is next.`,
    rest: true,
  };
}

function lastPerformance(history: readonly ResolvedSet[]) {
  const last = new Map<string, { workoutId: string; date: LocalDate; sets: ResolvedSet[] }>();
  for (const set of history) {
    const entry = last.get(set.identity);
    if (!entry || entry.workoutId !== set.workoutId) {
      // History is chronological, so a newer workout replaces the older one.
      last.set(set.identity, { workoutId: set.workoutId, date: set.date, sets: [set] });
    } else {
      entry.sets.push(set);
    }
  }
  return last;
}

export function planWorkout(input: PlannerInput): PlannedWorkout {
  const statuses = new Map(input.statuses.map((status) => [status.muscle, status]));
  const chosen = chooseDay(input, statuses);
  const last = lastPerformance(input.history);

  const used = new Set<string>();
  const exercises: PlannedExercise[] = [];

  const build = (def: ExerciseDef, slot: string, baseSets: number, topUp: boolean, extra: string[] = []) => {
    const notes = [...extra];
    let sets = baseSets;
    const status = statuses.get(def.primary[0]);
    if (!topUp && status?.state === "recovering") {
      sets = Math.max(2, sets - 1);
      notes.push(`${MUSCLE_META[status.muscle].label} is ${Math.round(status.recovery * 100)}% recovered — one set fewer.`);
    } else if (!topUp && status?.needsAttention) {
      sets = Math.min(5, sets + 1);
      notes.push(`${MUSCLE_META[status.muscle].label} is behind this week — one extra set.`);
    }
    const previous = last.get(def.key);
    const suggestion = suggestSets(def, sets, previous?.sets ?? []);
    used.add(def.key);
    exercises.push({
      key: def.key,
      name: def.name,
      slot,
      measure: def.measure,
      range: def.range,
      restSeconds: def.restSeconds,
      primary: def.primary,
      secondary: def.secondary,
      sets: suggestion.sets,
      rule: suggestion.rule,
      notes,
      last: previous
        ? {
            date: previous.date,
            sets: previous.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg, seconds: set.durationSeconds })),
          }
        : null,
      topUp,
    });
  };

  for (const slot of chosen.day.slots) {
    const candidates = slot.options
      .map((key) => exerciseByKey(key))
      .filter((def): def is ExerciseDef => def !== null && canDo(def, input.setup) && !used.has(def.key));
    if (candidates.length === 0) continue;
    // Keep doing what you have been doing: progress only means something on the same lift.
    const familiar = candidates
      .filter((def) => last.has(def.key))
      .sort((a, b) => (last.get(b.key)!.date > last.get(a.key)!.date ? 1 : -1))[0];
    build(familiar ?? candidates[0], slot.label, slot.sets, false);
  }

  // One top-up for a small muscle that has been left out, if it is fresh.
  const covered = new Set(exercises.flatMap((exercise) => exercise.primary));
  for (const status of attentionList(input.statuses)) {
    if (covered.has(status.muscle)) continue;
    const options = TOP_UP_EXERCISES[status.muscle];
    if (!options) continue;
    const def = options
      .map((key) => exerciseByKey(key))
      .find((entry): entry is ExerciseDef => entry !== null && canDo(entry, input.setup) && !used.has(entry.key));
    if (!def) continue;
    const label = MUSCLE_META[status.muscle].label;
    const why =
      status.daysSince === null
        ? `${label} has no training on record — added a short top-up.`
        : status.state === "neglected" || status.state === "due"
          ? `${label} hasn't been trained in ${status.daysSince} days — added a short top-up.`
          : `${label} is behind this week — added a short top-up.`;
    build(def, "Top-up", status.state === "neglected" ? 3 : 2, true, [why]);
    break;
  }

  const seconds = exercises.reduce(
    (total, exercise) => total + exercise.sets.length * (40 + exercise.restSeconds),
    0,
  );

  return {
    program: input.program.key,
    day: chosen.day.key,
    label: chosen.day.label,
    reason: chosen.reason,
    restSuggested: chosen.rest,
    exercises,
    estimatedMinutes: Math.max(10, Math.round(seconds / 60 / 5) * 5),
    muscles: [...new Set(exercises.flatMap((exercise) => exercise.primary))],
  };
}
