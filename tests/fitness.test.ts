import { describe, expect, it } from "vitest";
import { canDo, exerciseByKey, matchExercise, resolveExercise } from "@/lib/fitness/exercises";
import { resolveSets, type SetRecord } from "@/lib/fitness/history";
import { computeMuscleStatus, recoveryHoursFor } from "@/lib/fitness/status";
import { findPersonalRecords, suggestSets } from "@/lib/fitness/progression";
import { planWorkout } from "@/lib/fitness/planner";
import { PROGRAMS } from "@/lib/fitness/programs";

const TODAY = "2026-10-13"; // a Tuesday
const NOW = new Date("2026-10-13T12:00:00Z");

let counter = 0;
/** One completed set. `daysAgo` places the workout relative to TODAY at noon UTC. */
function set(
  exercise: string,
  daysAgo: number,
  values: { reps?: number; weightKg?: number; seconds?: number; workout?: string } = {},
): SetRecord {
  const at = new Date(NOW.getTime() - daysAgo * 86_400_000);
  counter += 1;
  return {
    workoutId: values.workout ?? `w-${daysAgo}`,
    workoutName: "Session",
    date: at.toISOString().slice(0, 10),
    trainedAt: at,
    workoutCompleted: true,
    exerciseKey: null,
    exerciseName: exercise,
    muscleGroup: null,
    exerciseOrder: 0,
    setOrder: counter,
    reps: values.reps ?? 10,
    weightKg: values.weightKg ?? null,
    durationSeconds: values.seconds ?? null,
  };
}

const times = (n: number, make: () => SetRecord) => Array.from({ length: n }, make);

describe("exercise library", () => {
  it("matches what people actually type", () => {
    expect(matchExercise("Bench Press")?.key).toBe("barbell-bench-press");
    expect(matchExercise("db bench")?.key).toBe("dumbbell-bench-press");
    expect(matchExercise("DB  Bench-Press")?.key).toBe("dumbbell-bench-press");
    expect(matchExercise("pullups")?.key).toBe("pull-up");
    expect(matchExercise("Squats")?.key).toBe("back-squat");
    expect(matchExercise("RDL")?.key).toBe("romanian-deadlift");
    expect(matchExercise("lateral raises")?.key).toBe("lateral-raise");
    expect(matchExercise("my secret exercise")).toBeNull();
  });

  it("falls back to a typed muscle group, and never guesses beyond it", () => {
    expect(resolveExercise({ name: "Cable thing", muscleGroup: "Chest" }).primary).toEqual(["chest"]);
    expect(resolveExercise({ name: "Cable thing", muscleGroup: "back" }).primary).toEqual(["lats", "upper_back"]);
    expect(resolveExercise({ name: "Cable thing", muscleGroup: "vibes" }).primary).toEqual([]);
    // A library match wins over a mislabelled group.
    expect(resolveExercise({ name: "Bench press", muscleGroup: "legs" }).primary).toEqual(["chest"]);
  });

  it("knows what each equipment setup allows", () => {
    expect(canDo(exerciseByKey("barbell-bench-press")!, "dumbbells")).toBe(false);
    expect(canDo(exerciseByKey("push-up")!, "bodyweight")).toBe(true);
    expect(canDo(exerciseByKey("overhead-triceps-extension")!, "dumbbells")).toBe(true);
  });

  it("only references muscles and keys that exist", () => {
    for (const day of [...PROGRAMS.ppl.days, ...PROGRAMS.push_pull.days]) {
      for (const slot of day.slots) for (const key of slot.options) expect(exerciseByKey(key), key).not.toBeNull();
    }
  });
});

describe("muscle status", () => {
  it("marks a hard chest session yesterday as recovering, with partial recovery", () => {
    const sets = resolveSets(times(6, () => set("Bench press", 1, { weightKg: 60 })));
    const chest = computeMuscleStatus(sets, TODAY, NOW).find((s) => s.muscle === "chest")!;
    expect(chest.state).toBe("recovering");
    expect(chest.recovery).toBeGreaterThan(0.2);
    expect(chest.recovery).toBeLessThan(0.5);
    expect(chest.weeklySets).toBe(6);
    // Secondary muscles get half credit.
    const triceps = computeMuscleStatus(sets, TODAY, NOW).find((s) => s.muscle === "triceps")!;
    expect(triceps.weeklySets).toBe(3);
  });

  it("recovers faster from a light session", () => {
    expect(recoveryHoursFor("chest", 2)).toBeLessThan(recoveryHoursFor("chest", 6));
    expect(recoveryHoursFor("chest", 12)).toBe(72);
    const chestAfter = (sets: SetRecord[]) =>
      computeMuscleStatus(resolveSets(sets), TODAY, NOW).find((s) => s.muscle === "chest")!;
    const light = chestAfter(times(2, () => set("Bench press", 1)));
    const heavy = chestAfter(times(6, () => set("Bench press", 1)));
    expect(light.recovery).toBeGreaterThan(0.9);
    expect(light.recovery).toBeGreaterThan(heavy.recovery);
    // Two days on, the light session has cleared and the heavy one has not.
    expect(chestAfter(times(2, () => set("Bench press", 2))).state).not.toBe("recovering");
    expect(chestAfter(times(6, () => set("Bench press", 2))).state).toBe("recovering");
  });

  it("calls a muscle due after five days and neglected after ten or never", () => {
    const sets = resolveSets([...times(6, () => set("Squat", 6)), ...times(6, () => set("Bench press", 12))]);
    const statuses = computeMuscleStatus(sets, TODAY, NOW);
    expect(statuses.find((s) => s.muscle === "quads")!.state).toBe("due");
    expect(statuses.find((s) => s.muscle === "chest")!.state).toBe("neglected");
    expect(statuses.find((s) => s.muscle === "calves")!.state).toBe("neglected");
    expect(statuses.find((s) => s.muscle === "calves")!.needsAttention).toBe(true);
  });
});

describe("progression", () => {
  const bench = exerciseByKey("barbell-bench-press")!; // 6–10, +2.5 kg
  const pushUp = exerciseByKey("push-up")!; // 10–20, bodyweight

  it("adds weight once every set reaches the top of the range", () => {
    const last = [10, 10, 10].map((reps) => ({ reps, weightKg: 60, durationSeconds: null }));
    const next = suggestSets(bench, 3, last);
    expect(next.sets).toEqual([1, 2, 3].map(() => ({ reps: 6, weightKg: 62.5, seconds: null })));
  });

  it("otherwise keeps the weight and asks for one more rep", () => {
    const last = [10, 8, 7].map((reps) => ({ reps, weightKg: 60, durationSeconds: null }));
    expect(suggestSets(bench, 3, last).sets.map((s) => [s.weightKg, s.reps])).toEqual([
      [60, 10],
      [60, 9],
      [60, 8],
    ]);
  });

  it("does not invent a weight without history, and progresses bodyweight by reps", () => {
    expect(suggestSets(bench, 3, []).sets[0]).toEqual({ reps: 8, weightKg: null, seconds: null });
    const last = [12, 11].map((reps) => ({ reps, weightKg: null, durationSeconds: null }));
    expect(suggestSets(pushUp, 2, last).sets.map((s) => s.reps)).toEqual([13, 12]);
  });

  it("finds PRs after a baseline, at most one per exercise per session", () => {
    const sets = resolveSets([
      set("Bench press", 9, { weightKg: 60, reps: 8, workout: "a" }),
      set("Bench press", 5, { weightKg: 60, reps: 8, workout: "b" }),
      set("Bench press", 2, { weightKg: 62.5, reps: 8, workout: "c" }),
      set("Bench press", 2, { weightKg: 65, reps: 6, workout: "c" }),
    ]);
    const prs = findPersonalRecords(sets);
    expect(prs).toHaveLength(1);
    expect(prs[0].workoutId).toBe("c");
  });
});

describe("planner", () => {
  const plan = (input: Partial<Parameters<typeof planWorkout>[0]> & { sets?: SetRecord[] }) => {
    const history = resolveSets(input.sets ?? []);
    return planWorkout({
      program: PROGRAMS.ppl,
      setup: "gym",
      lastDay: null,
      statuses: computeMuscleStatus(history, TODAY, NOW),
      history,
      ...input,
    });
  };

  it("follows the rotation", () => {
    expect(plan({}).day).toBe("push");
    expect(plan({ lastDay: "push" }).day).toBe("pull");
    expect(plan({ lastDay: "legs" }).day).toBe("push");
  });

  it("skips a day whose muscles are still recovering when another is ready", () => {
    const sets = [...times(8, () => set("Lat pulldown", 0.5)), ...times(8, () => set("Barbell row", 0.5))];
    const result = plan({ lastDay: "push", sets });
    expect(result.day).toBe("legs");
    expect(result.reason).toMatch(/still recovering/);
  });

  it("only prescribes what the equipment allows", () => {
    const result = plan({ setup: "bodyweight" });
    expect(result.exercises.length).toBeGreaterThan(0);
    for (const exercise of result.exercises) expect(canDo(exerciseByKey(exercise.key)!, "bodyweight")).toBe(true);
  });

  it("keeps the lift you have been doing so progress carries over", () => {
    const sets = times(3, () => set("Dumbbell bench press", 10, { weightKg: 20 }));
    const press = plan({ sets }).exercises.find((exercise) => exercise.slot === "Horizontal press")!;
    expect(press.key).toBe("dumbbell-bench-press");
    expect(press.sets[0].weightKg).toBe(20);
    expect(press.last?.sets).toHaveLength(3);
  });

  it("adds a top-up for a small muscle left out, and an extra set for a lagging one", () => {
    const result = plan({});
    const topUp = result.exercises.find((exercise) => exercise.topUp);
    expect(topUp).toBeDefined();
    expect(topUp!.notes[0]).toMatch(/top-up/);
    // Nothing trained yet: every push muscle is behind, so main lifts get +1.
    const press = result.exercises.find((exercise) => exercise.slot === "Horizontal press")!;
    expect(press.sets).toHaveLength(5);
    expect(result.estimatedMinutes).toBeGreaterThan(20);
  });
});
