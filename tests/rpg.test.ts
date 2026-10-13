import { describe, expect, it } from "vitest";
import { resolveSets, type SetRecord } from "@/lib/fitness/history";
import { computeMuscleStatus } from "@/lib/fitness/status";
import { findPersonalRecords } from "@/lib/fitness/progression";
import { levelFromXp, summariseSessions, titleFor, trainingXp, xpForLevel } from "@/lib/rpg/xp";
import { computeAchievements } from "@/lib/rpg/achievements";
import { claimId, computeMissions, weeklyFocusMuscle } from "@/lib/rpg/missions";

const TODAY = "2026-10-13"; // Tuesday; the week started 2026-10-12
const NOW = new Date("2026-10-13T18:00:00Z");

let order = 0;
function set(exercise: string, date: string, workout: string, values: Partial<SetRecord> = {}): SetRecord {
  order += 1;
  return {
    workoutId: workout,
    workoutName: "Session",
    date,
    trainedAt: new Date(`${date}T12:00:00Z`),
    workoutCompleted: true,
    exerciseKey: null,
    exerciseName: exercise,
    muscleGroup: null,
    exerciseOrder: 0,
    setOrder: order,
    reps: 10,
    weightKg: 50,
    durationSeconds: null,
    ...values,
  };
}

describe("levels", () => {
  it("climbs a widening curve", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    const mid = levelFromXp(200);
    expect(mid.level).toBe(2);
    expect(mid.progress).toBeCloseTo(0.5);
    expect(titleFor(1)).toBe("Rookie");
    expect(titleFor(9)).toBe("Lifter");
  });

  it("pays for sets, finished sessions and PRs — and nothing for an empty session", () => {
    const sets = resolveSets([
      set("Bench press", "2026-10-05", "a"),
      set("Bench press", "2026-10-05", "a"),
      set("Bench press", "2026-10-12", "b", { weightKg: 55 }),
      set("Squat", "2026-10-12", "c", { workoutCompleted: false }),
    ]);
    const sessions = summariseSessions(sets, findPersonalRecords(sets));
    const xp = trainingXp(sessions);
    expect(xp.sets).toBe(40);
    expect(xp.sessions).toBe(100); // a and b were finished, c was not
    expect(xp.prs).toBe(25);
    expect(xp.total).toBe(165);
  });
});

describe("achievements", () => {
  it("unlock on the day the threshold was crossed", () => {
    const sets = resolveSets([set("Bench press", "2026-10-01", "a"), set("Bench press", "2026-10-08", "b", { weightKg: 60 })]);
    const prs = findPersonalRecords(sets);
    const achievements = computeAchievements({ sets, sessions: summariseSessions(sets, prs), prs });
    const first = achievements.find((a) => a.key === "first-session")!;
    expect(first.unlocked).toBe(true);
    expect(first.unlockedOn).toBe("2026-10-01");
    expect(achievements.find((a) => a.key === "first-pr")!.unlockedOn).toBe("2026-10-08");
    const ten = achievements.find((a) => a.key === "sessions-10")!;
    expect(ten.unlocked).toBe(false);
    expect(ten.progress).toBe(2);
  });
});

describe("missions", () => {
  function missionsFor(records: SetRecord[], claimed: string[] = [], extra: Partial<Parameters<typeof computeMissions>[0]> = {}) {
    const sets = resolveSets(records);
    const prs = findPersonalRecords(sets);
    const before = (date: string) => resolveSets(records.filter((record) => record.date < date));
    return computeMissions({
      today: TODAY,
      daysPerWeek: 3,
      sets,
      sessions: summariseSessions(sets, prs),
      prs,
      statusesAtDayStart: computeMuscleStatus(before(TODAY), TODAY, NOW),
      statusesAtWeekStart: computeMuscleStatus(before("2026-10-12"), "2026-10-11", NOW),
      protein: 120,
      proteinTarget: 150,
      sleepHours: 0,
      claimed: new Set(claimed),
      ...extra,
    });
  }

  it("tracks today's session, protein and the weekly count", () => {
    const missions = missionsFor([set("Bench press", TODAY, "t")]);
    const session = missions.find((m) => m.key === "daily-session")!;
    expect(session.complete).toBe(true);
    expect(session.claimed).toBe(false);
    const protein = missions.find((m) => m.key === "daily-protein")!;
    expect(protein.progress).toBe(120);
    expect(protein.complete).toBe(false);
    expect(missions.find((m) => m.key === "weekly-sessions")!.progress).toBe(1);
  });

  it("switches to recovery once the week's sessions are done", () => {
    const records = ["2026-10-12", "2026-10-12"].map((date, i) => set("Squat", date, `s${i}`));
    const missions = missionsFor(records, [], { daysPerWeek: 2 });
    expect(missions.some((m) => m.key === "daily-session")).toBe(false);
    expect(missions.find((m) => m.key === "daily-recover")).toBeDefined();
  });

  it("fixes the weekly focus muscle at the start of the week", () => {
    const records = [...Array.from({ length: 12 }, () => set("Squat", "2026-10-08", "old"))];
    const before = computeMuscleStatus(resolveSets(records), "2026-10-11", NOW);
    const focus = weeklyFocusMuscle(before);
    expect(focus).not.toBe("quads");
    // Training the focus muscle this week does not move the goalposts.
    const missions = missionsFor([...records, set("Bench press", TODAY, "t")]);
    expect(missions.find((m) => m.key.startsWith("weekly-focus-"))!.key).toBe(`weekly-focus-${focus}`);
  });

  it("knows which missions were claimed", () => {
    const missions = missionsFor([set("Bench press", TODAY, "t")], [claimId("daily-session", TODAY)]);
    expect(missions.find((m) => m.key === "daily-session")!.claimed).toBe(true);
  });
});
