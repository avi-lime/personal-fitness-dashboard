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

describe("exercise catalogue", () => {
  it("places names the library does not know, from any app's dialect", async () => {
    const { matchCatalogue, resolveFully } = await import("@/lib/fitness/catalogue");
    expect(matchCatalogue("Cable Lateral Raise")?.primary).toEqual(["side_delts"]);
    // Equipment in parentheses, word order swapped: still the same lift.
    expect(matchCatalogue("Bulgarian Split Squat (Dumbbell)")?.primary).toContain("quads");
    expect(resolveFully({ name: "Hip Adduction (Machine)" }).primary).toEqual([]);
    // A stretch is not training.
    expect(resolveFully({ name: "hamstring stretch" }).primary).toEqual([]);
  });

  it("refuses to guess between equally close lifts", async () => {
    const { matchCatalogue } = await import("@/lib/fitness/catalogue");
    expect(matchCatalogue("press")).toBeNull();
  });

  it("keeps the library and the user's own muscle group ahead of the catalogue", async () => {
    const { resolveFully } = await import("@/lib/fitness/catalogue");
    expect(resolveFully({ name: "Bench press" }).identity).toBe("barbell-bench-press");
    // Outside the library, a muscle group the user typed beats the catalogue.
    expect(resolveFully({ name: "Zercher squat", muscleGroup: "glutes" }).primary).toEqual(["glutes"]);
    expect(resolveFully({ name: "Zercher squat" }).identity).toMatch(/^catalogue:/);
  });
});

describe("catalogue tie-break", () => {
  it("reads an unqualified name as the barbell lift, and only then", async () => {
    const { matchCatalogue } = await import("@/lib/fitness/catalogue");
    expect(matchCatalogue("Zercher Squat")?.name).toBe("barbell zercher squat");
    // No barbell candidate among the ties: still no guess.
    expect(matchCatalogue("press")).toBeNull();
  });
});

describe("warm-ups and drops", () => {
  it("ramps up to a known working weight, snapped to the lift's increment", async () => {
    const { warmupRamp } = await import("@/lib/fitness/progression");
    expect(warmupRamp(exerciseByKey("barbell-bench-press")!, 60).map((s) => [s.weightKg, s.reps])).toEqual([
      [20, 10],
      [30, 8],
      [40, 5],
      [50, 3],
    ]);
    expect(warmupRamp(exerciseByKey("dumbbell-bench-press")!, 20).map((s) => [s.weightKg, s.reps])).toEqual([
      [10, 10],
      [14, 5],
    ]);
    // Isolation, bodyweight, and lifts with no known weight get none.
    expect(warmupRamp(exerciseByKey("lateral-raise")!, 10)).toEqual([]);
    expect(warmupRamp(exerciseByKey("pull-up")!, null)).toEqual([]);
    expect(warmupRamp(exerciseByKey("barbell-bench-press")!, null)).toEqual([]);
  });

  it("warms up the first heavy lift for a muscle, not the ones after it", () => {
    const history = resolveSets([
      ...times(3, () => set("Bench press", 9, { weightKg: 60, reps: 8 })),
      ...times(3, () => set("Incline bench press", 9, { weightKg: 40, reps: 8 })),
    ]);
    const result = planWorkout({
      program: PROGRAMS.ppl,
      setup: "gym",
      lastDay: "legs",
      statuses: computeMuscleStatus(history, TODAY, NOW),
      history,
    });
    const bench = result.exercises.find((exercise) => exercise.key === "barbell-bench-press")!;
    expect(bench.warmups.length).toBeGreaterThan(0);
    const incline = result.exercises.find((exercise) => exercise.primary.includes("chest") && exercise.key !== bench.key)!;
    expect(incline.warmups).toEqual([]);
  });

  it("counts a drop set's drops in volume, but as one set", async () => {
    const { summariseSessions } = await import("@/lib/rpg/xp");
    const sets = resolveSets([{ ...set("Bench press", 1, { weightKg: 60, reps: 8 }), drops: [{ weightKg: 48, reps: 8 }] }]);
    const [session] = summariseSessions(sets, []);
    expect(session.sets).toBe(1);
    expect(session.volumeKg).toBe(60 * 8 + 48 * 8);
  });
});

describe("progression schemes", () => {
  const bench = () => exerciseByKey("barbell-bench-press")!; // 6–10, +2.5 kg
  const session = (weightKg: number, reps: number[]) => reps.map((r) => ({ reps: r, weightKg, durationSeconds: null }));

  it("linear: up after a clean session, stay after a miss, back off after three", async () => {
    const { suggestFor } = await import("@/lib/fitness/progression");
    expect(suggestFor(bench(), "linear", 3, [session(60, [6, 6, 6])]).sets[0]).toEqual({ reps: 6, weightKg: 62.5, seconds: null });
    expect(suggestFor(bench(), "linear", 3, [session(60, [6, 6, 5])]).sets[0].weightKg).toBe(60);
    // Fewer sets than prescribed is a miss too.
    expect(suggestFor(bench(), "linear", 3, [session(60, [6, 6])]).sets[0].weightKg).toBe(60);
    const stuck = [session(60, [6, 5, 5]), session(60, [6, 6, 4]), session(60, [5, 5, 5])];
    const back = suggestFor(bench(), "linear", 3, stuck);
    expect(back.sets[0].weightKg).toBe(52.5);
    expect(back.rule).toMatch(/back off 10%/);
  });

  it("greyskull: two of 5 and one to failure; beat it, double it, or reset", async () => {
    const { suggestFor } = await import("@/lib/fitness/progression");
    const first = suggestFor(bench(), "greyskull", 4, []);
    expect(first.sets).toHaveLength(3);
    expect(first.sets[2].amrap).toBe(true);
    expect(suggestFor(bench(), "greyskull", 3, [session(60, [5, 5, 7])]).sets[0].weightKg).toBe(62.5);
    expect(suggestFor(bench(), "greyskull", 3, [session(60, [5, 5, 10])]).sets[0].weightKg).toBe(65);
    expect(suggestFor(bench(), "greyskull", 3, [session(60, [5, 4, 6])]).sets[0].weightKg).toBe(52.5);
  });

  it("leaves accessories and bodyweight work on double progression", async () => {
    const { suggestFor, suggestSets } = await import("@/lib/fitness/progression");
    const raise = exerciseByKey("lateral-raise")!;
    const last = session(8, [15, 14, 13]);
    expect(suggestFor(raise, "greyskull", 3, [last])).toEqual(suggestSets(raise, 3, last));
    expect(suggestFor(exerciseByKey("pull-up")!, "linear", 3, [session(0, [8, 8, 8])]).sets).toHaveLength(3);
  });

  it("plans Greyskull main lifts as three sets whatever the slot says", () => {
    const history = resolveSets(times(3, () => set("Bench press", 9, { weightKg: 60, reps: 5 })));
    const result = planWorkout({
      program: PROGRAMS.ppl,
      setup: "gym",
      lastDay: "legs",
      statuses: computeMuscleStatus(history, TODAY, NOW),
      history,
      scheme: "greyskull",
    });
    const press = result.exercises.find((exercise) => exercise.key === "barbell-bench-press")!;
    expect(press.sets).toHaveLength(3);
    expect(press.sets[2].amrap).toBe(true);
  });
});
