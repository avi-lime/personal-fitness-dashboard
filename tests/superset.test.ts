import { describe, expect, it } from "vitest";
import { afterSet, exerciseLabels, unitsOf, WARMUP_REST_SECONDS, type FlowExercise } from "@/lib/fitness/superset";

/** An exercise with `total` work sets of which the first `completed` are done. */
const ex = (group: number | null, rest: number, total: number, completed: number, warmups = 0): FlowExercise => ({
  supersetGroup: group,
  restSeconds: rest,
  sets: [
    ...Array.from({ length: warmups }, (_, i) => ({ id: `w${i}`, phase: "warmup" as const, completed: false })),
    ...Array.from({ length: total }, (_, i) => ({ id: `s${i}`, phase: "work" as const, completed: i < completed })),
  ],
});

describe("superset flow", () => {
  it("groups neighbours with the same group, and only neighbours", () => {
    expect(unitsOf([ex(null, 90, 3, 0), ex(1, 60, 3, 0), ex(1, 90, 3, 0), ex(null, 60, 3, 0)])).toEqual([[0], [1, 2], [3]]);
    expect(exerciseLabels([ex(null, 90, 3, 0), ex(1, 60, 3, 0), ex(1, 90, 3, 0), ex(null, 60, 3, 0)])).toEqual(["1", "A1", "A2", "2"]);
  });

  it("goes straight to the partner mid-round, then rests the longest rest after it", () => {
    // A1 just finished its first set; A2 has not done round one yet.
    expect(afterSet([ex(1, 60, 3, 1), ex(1, 120, 3, 0)], 0, "s0")).toEqual({ restSeconds: 0, next: 1 });
    // A2 finished round one: rest the longer of the two, back to A1.
    expect(afterSet([ex(1, 60, 3, 1), ex(1, 120, 3, 1)], 1, "s0")).toEqual({ restSeconds: 120, next: 0 });
  });

  it("handles uneven supersets: the member with sets left carries on alone", () => {
    expect(afterSet([ex(1, 60, 2, 2), ex(1, 90, 4, 2)], 1, "s1")).toEqual({ restSeconds: 90, next: 1 });
  });

  it("rests after every set, the last of an exercise included, but not the last of the session", () => {
    expect(afterSet([ex(null, 90, 3, 2), ex(null, 60, 3, 0)], 0, "s1")).toEqual({ restSeconds: 90, next: 0 });
    expect(afterSet([ex(null, 90, 3, 3), ex(null, 60, 3, 0)], 0, "s2")).toEqual({ restSeconds: 90, next: 1 });
    expect(afterSet([ex(null, 90, 3, 3), ex(null, 60, 3, 3)], 1, "s2")).toEqual({ restSeconds: 0, next: 1 });
  });

  it("wraps back to work that was skipped instead of declaring the session done", () => {
    expect(afterSet([ex(null, 90, 3, 1), ex(null, 60, 3, 3)], 1, "s2")).toEqual({ restSeconds: 60, next: 0 });
  });

  it("gives warm-ups a short rest and stays put", () => {
    const exercises = [ex(null, 150, 3, 0, 2)];
    exercises[0].sets[0].completed = true;
    expect(afterSet(exercises, 0, "w0")).toEqual({ restSeconds: WARMUP_REST_SECONDS, next: 0 });
  });
});
