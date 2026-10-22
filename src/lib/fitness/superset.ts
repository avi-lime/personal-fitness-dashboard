/**
 * What happens after a set is ticked: how long to rest, and which exercise
 * comes up next. Ported from openGym's superset flow (AGPL, see NOTICE.md).
 *
 * Neighbouring exercises sharing a superset group are one unit; a plain
 * exercise is a unit of one. Inside a superset you go straight to the next
 * member that still owes this round's set — no rest — and rest once after the
 * round, for the longest rest any member asks for, so the member that needs
 * the most recovery is ready. Every set earns a rest except the very last one
 * of the session. Warm-ups rest briefly and never move you on.
 */
export interface FlowSet {
  id: string;
  phase: "work" | "warmup";
  completed: boolean;
}

export interface FlowExercise {
  supersetGroup: number | null;
  restSeconds: number;
  sets: FlowSet[];
}

export const WARMUP_REST_SECONDS = 60;

/** Exercise indices grouped into units, in order. */
export function unitsOf(exercises: readonly FlowExercise[]): number[][] {
  const units: number[][] = [];
  exercises.forEach((exercise, index) => {
    const previous = units.at(-1);
    const group = exercise.supersetGroup;
    if (group !== null && previous && exercises[previous[0]].supersetGroup === group) previous.push(index);
    else units.push([index]);
  });
  return units;
}

const work = (exercise: FlowExercise) => exercise.sets.filter((set) => set.phase === "work");
const done = (exercise: FlowExercise) => work(exercise).filter((set) => set.completed).length;
const owes = (exercise: FlowExercise) => work(exercise).some((set) => !set.completed);

/**
 * `exercises` is the state *after* the set was completed. Returns the rest to
 * start (0 for none) and the exercise to show next.
 */
export function afterSet(
  exercises: readonly FlowExercise[],
  index: number,
  setId: string,
): { restSeconds: number; next: number } {
  const exercise = exercises[index];
  const set = exercise.sets.find((entry) => entry.id === setId);
  if (!set || set.phase === "warmup") return { restSeconds: WARMUP_REST_SECONDS, next: index };

  const units = unitsOf(exercises);
  const unitAt = units.findIndex((unit) => unit.includes(index));
  const unit = units[unitAt];

  // Mid-round: the next member (in order, wrapping) that has not done this round's set.
  const round = done(exercise);
  const order = [...unit.slice(unit.indexOf(index) + 1), ...unit.slice(0, unit.indexOf(index))];
  const pending = order.find((member) => owes(exercises[member]) && done(exercises[member]) < round);
  if (pending !== undefined) return { restSeconds: 0, next: pending };

  const rest = Math.max(...unit.map((member) => exercises[member].restSeconds));
  // Round over. More rounds in this unit: rest, then its first member that still owes a set.
  const again = unit.find((member) => owes(exercises[member]));
  if (again !== undefined) return { restSeconds: rest, next: again };

  // Unit finished: rest, then the next unfinished unit — wrapping, so work skipped earlier is
  // offered before the session counts as done.
  const later = [...units.slice(unitAt + 1), ...units.slice(0, unitAt)].find((candidate) =>
    candidate.some((member) => owes(exercises[member])),
  );
  if (later) return { restSeconds: rest, next: later[0] };
  // Nothing left anywhere: the session is over and there is nothing to rest for.
  return { restSeconds: 0, next: index };
}

/** "A1", "A2" for superset members, the plain number otherwise. */
export function exerciseLabels(exercises: readonly FlowExercise[]): string[] {
  const labels: string[] = [];
  let letter = 0;
  let plain = 0;
  for (const unit of unitsOf(exercises)) {
    if (unit.length === 1) {
      plain += 1;
      labels[unit[0]] = String(plain);
      continue;
    }
    const code = String.fromCharCode(65 + (letter % 26));
    letter += 1;
    unit.forEach((member, position) => {
      labels[member] = `${code}${position + 1}`;
    });
  }
  return labels;
}
