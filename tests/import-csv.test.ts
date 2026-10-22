import { describe, expect, it } from "vitest";
import { matchExercise } from "@/lib/fitness/exercises";
import { parseCSV, parseWhen, parseWorkoutCSV } from "@/lib/fitness/import-csv";

// Real export rows from openGym's test suite (AGPL, see NOTICE.md).
const STRONG = [
  "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE",
  '2026-04-02 18:05:00,"Upper A",1h 5m,"Bench Press (Barbell)",1,60,8,0,0,"","Good day",8',
  '2026-04-02 18:05:00,"Upper A",1h 5m,"Bench Press (Barbell)",2,60,8,0,0,"Paused reps","Good day",8.5',
  '2026-04-02 18:05:00,"Upper A",1h 5m,"Bent Over Row (Barbell)",1,50,10,0,0,"","Good day",',
  '2026-04-02 18:05:00,"Upper A",1h 5m,"Plank",1,0,0,0,60,"","Good day",',
  '2026-04-05 17:00:00,"Legs",52m,"Squat (Barbell)",1,80,5,0,0,"","",',
  '2026-04-05 17:00:00,"Legs",52m,"Running (Treadmill)",1,0,0,3,1200,"","",',
].join("\n");

const HEVY = [
  '"title","start_time","end_time","description","exercise_title","superset_id","exercise_notes","set_index","set_type","weight_kg","reps","distance_km","duration_seconds","rpe"',
  '"Push","3 févr. 2026, 18:00","3 févr. 2026, 19:10","Felt fresh","Bench Press (Barbell)",,"",0,"warmup",20,10,,,',
  '"Push","3 févr. 2026, 18:00","3 févr. 2026, 19:10","Felt fresh","Bench Press (Barbell)",,"",1,"normal",62.5,8,,,8',
  '"Push","3 févr. 2026, 18:00","3 févr. 2026, 19:10","Felt fresh","Bench Press (Barbell)",,"",2,"dropset",50,8,,,',
  '"Push","3 févr. 2026, 18:00","3 févr. 2026, 19:10","Felt fresh","Lateral Raise (Dumbbell)",0,"",0,"normal",10,12,,,',
  '"Push","3 févr. 2026, 18:00","3 févr. 2026, 19:10","Felt fresh","Triceps Pushdown",0,"",0,"normal",25,12,,,',
  '"Push","3 févr. 2026, 18:00","3 févr. 2026, 19:10","Felt fresh","Lateral Raise (Dumbbell)",0,"",1,"normal",10,12,,,',
  '"Push","3 févr. 2026, 18:00","3 févr. 2026, 19:10","Felt fresh","Triceps Pushdown",0,"",1,"normal",25,12,,,',
].join("\n");

const FITNOTES = [
  "Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment",
  "2025-11-03,Deadlift,Back,225,lbs,5,,,,",
  "2025-11-03,Dumbbell Bench Press,Chest,30,kgs,10,,,,",
].join("\n");

describe("matching other apps' names to the library", () => {
  it("reads qualifiers in any order, and never swaps the equipment", () => {
    expect(matchExercise("Bench Press (Barbell)")?.key).toBe("barbell-bench-press");
    expect(matchExercise("Bent Over Row (Barbell)")?.key).toBe("barbell-row");
    expect(matchExercise("Lat Pulldown (Cable)")?.key).toBe("lat-pulldown");
    expect(matchExercise("Squat (Barbell)")?.key).toBe("back-squat");
    expect(matchExercise("Bench Press (Dumbbell)")?.key).toBe("dumbbell-bench-press");
    // A dumbbell lift is never filed under the barbell one with the same movement.
    expect(matchExercise("Dumbbell Overhead Press")?.key).not.toBe("overhead-press");
  });
});

describe("CSV import", () => {
  it("reads quoted fields, embedded commas and semicolon files", () => {
    expect(parseCSV('a,"b, c",d\n1,"2 ""x""",3')).toEqual([["a", "b, c", "d"], ["1", '2 "x"', "3"]]);
    expect(parseCSV("Date;Exercise\n2025-01-01;Squat")).toEqual([["Date", "Exercise"], ["2025-01-01", "Squat"]]);
  });

  it("parses dates in every shape the apps write, in several languages", () => {
    expect(parseWhen("2026-04-02 18:05:00")).toEqual({ date: "2026-04-02", ms: (18 * 60 + 5) * 60_000 });
    expect(parseWhen("3 févr. 2026, 18:00")?.date).toBe("2026-02-03");
    expect(parseWhen("21 août 2024, 18:00")?.date).toBe("2024-08-21");
    expect(parseWhen("Mar 3, 2025")?.date).toBe("2025-03-03");
    expect(parseWhen("07/03/2024")?.date).toBe("2024-03-07");
    expect(parseWhen("31 Feb 2024")).toBeNull();
    expect(parseWhen("2999-01-01")).toBeNull();
  });

  it("imports a Strong export: sessions, the workout's length, timed holds, no cardio", () => {
    const parsed = parseWorkoutCSV(STRONG);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.source).toBe("Strong");
    expect(parsed.cardioSkipped).toBe(1);
    const [upper, legs] = parsed.workouts;
    expect(upper.name).toBe("Upper A");
    expect(upper.notes).toBe("Good day");
    expect(((upper.endMs ?? 0) - (upper.startMs ?? 0)) / 60_000).toBe(65);
    expect(legs.date).toBe("2026-04-05");

    const bench = upper.exercises.find((exercise) => exercise.exerciseKey === "barbell-bench-press")!;
    expect(bench.sets.map((set) => [set.weightKg, set.reps, set.rpe])).toEqual([[60, 8, 8], [60, 8, 8.5]]);
    const plank = upper.exercises.find((exercise) => exercise.exerciseKey === "plank")!;
    expect(plank.sets[0]).toMatchObject({ durationSeconds: 60, reps: null });
  });

  it("imports a Hevy export: French dates, warm-ups, drops and supersets", () => {
    const parsed = parseWorkoutCSV(HEVY);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.source).toBe("Hevy");
    const [push] = parsed.workouts;
    expect(push.date).toBe("2026-02-03");
    const bench = push.exercises[0];
    expect(bench.sets.map((set) => set.phase)).toEqual(["warmup", "work"]);
    expect(bench.sets[1].drops).toEqual([{ weightKg: 50, reps: 8 }]);
    expect(parsed.warmups).toBe(1);
    const [, raise, pushdown] = push.exercises;
    expect(raise.supersetGroup).not.toBeNull();
    expect(pushdown.supersetGroup).toBe(raise.supersetGroup);
    expect(bench.supersetGroup).toBeNull();
  });

  it("converts pounds per row, so a mixed-unit FitNotes history stays right", () => {
    const parsed = parseWorkoutCSV(FITNOTES);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.source).toBe("FitNotes");
    expect(parsed.convertedFromLb).toBe(true);
    const [day] = parsed.workouts;
    expect(day.exercises[0].sets[0].weightKg).toBe(102.1);
    expect(day.exercises[1].sets[0].weightKg).toBe(30);
  });

  it("refuses files it cannot read rather than guessing", () => {
    expect(parseWorkoutCSV("")).toEqual({ ok: false, error: "empty" });
    expect(parseWorkoutCSV("foo,bar\n1,2")).toEqual({ ok: false, error: "unrecognised" });
  });
});
