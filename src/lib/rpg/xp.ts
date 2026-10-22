import { creditFor, type ResolvedSet } from "@/lib/fitness/history";
import { MUSCLES, type Muscle } from "@/lib/fitness/muscles";
import type { PersonalRecord } from "@/lib/fitness/progression";
import type { LocalDate } from "@/lib/date";

/**
 * Experience and levels.
 *
 * Training XP is never stored: it is recomputed from completed sets every
 * time, so editing or deleting a set moves the XP with it and there is no
 * counter to drift or to farm. Only things that happened *once* — a claimed
 * mission, a redeemed reward — are written down (see `rpg_ledger`).
 */
export const XP_PER_SET = 10;
export const XP_PER_SESSION = 50;
export const XP_PER_PR = 25;
/** Muscle XP per set: full for the target muscle, half for a helper. */
export const MUSCLE_XP_PER_SET = 10;

/** Total XP needed to reach a level. 100 for level 2, then 200 more, 300 more… */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1);
}

/** Muscle levels run on a gentler curve, since one muscle earns far less. */
export function muscleXpForLevel(level: number): number {
  return 20 * level * (level - 1);
}

export interface LevelProgress {
  level: number;
  /** XP earned inside the current level. */
  current: number;
  /** XP the current level spans. */
  needed: number;
  /** 0–1 towards the next level. */
  progress: number;
  total: number;
}

function progressOn(total: number, curve: (level: number) => number): LevelProgress {
  let level = 1;
  while (curve(level + 1) <= total) level += 1;
  const floor = curve(level);
  const needed = curve(level + 1) - floor;
  const current = total - floor;
  return { level, current, needed, progress: needed > 0 ? current / needed : 0, total };
}

export const levelFromXp = (total: number) => progressOn(Math.max(0, total), xpForLevel);
export const muscleLevelFromXp = (total: number) => progressOn(Math.max(0, total), muscleXpForLevel);

const TITLES: Array<[number, string]> = [
  [30, "Legend"],
  [25, "Champion"],
  [20, "Iron Knight"],
  [16, "Veteran"],
  [12, "Iron Adept"],
  [8, "Lifter"],
  [5, "Apprentice"],
  [3, "Trainee"],
  [1, "Rookie"],
];

export function titleFor(level: number): string {
  return TITLES.find(([threshold]) => level >= threshold)?.[1] ?? "Rookie";
}

export interface SessionSummary {
  workoutId: string;
  name: string;
  date: LocalDate;
  completed: boolean;
  sets: number;
  /** kg moved: weight × reps over loaded sets. */
  volumeKg: number;
  prs: number;
  xp: number;
}

/** One summary per workout that has at least one completed set, oldest first. */
export function summariseSessions(
  sets: readonly ResolvedSet[],
  prs: readonly PersonalRecord[],
): SessionSummary[] {
  const prsByWorkout = new Map<string, number>();
  for (const record of prs) prsByWorkout.set(record.workoutId, (prsByWorkout.get(record.workoutId) ?? 0) + 1);

  const sessions = new Map<string, SessionSummary>();
  for (const set of sets) {
    const session = sessions.get(set.workoutId) ?? {
      workoutId: set.workoutId,
      name: set.workoutName,
      date: set.date,
      completed: set.workoutCompleted,
      sets: 0,
      volumeKg: 0,
      prs: prsByWorkout.get(set.workoutId) ?? 0,
      xp: 0,
    };
    session.sets += 1;
    session.volumeKg += (set.weightKg ?? 0) * (set.reps ?? 0);
    for (const drop of set.drops ?? []) session.volumeKg += (drop.weightKg ?? 0) * (drop.reps ?? 0);
    sessions.set(set.workoutId, session);
  }
  for (const session of sessions.values()) {
    session.volumeKg = Math.round(session.volumeKg);
    session.xp =
      session.sets * XP_PER_SET + (session.completed ? XP_PER_SESSION : 0) + session.prs * XP_PER_PR;
  }
  return [...sessions.values()];
}

export interface TrainingXp {
  sets: number;
  sessions: number;
  prs: number;
  total: number;
}

export function trainingXp(sessions: readonly SessionSummary[]): TrainingXp {
  const sets = sessions.reduce((total, session) => total + session.sets, 0) * XP_PER_SET;
  const completed = sessions.filter((session) => session.completed).length * XP_PER_SESSION;
  const prs = sessions.reduce((total, session) => total + session.prs, 0) * XP_PER_PR;
  return { sets, sessions: completed, prs, total: sets + completed + prs };
}

/** Per-muscle XP: the RPG "skill" for each part of the body. */
export function muscleXp(sets: readonly ResolvedSet[]): Record<Muscle, number> {
  const totals = Object.fromEntries(MUSCLES.map((muscle) => [muscle, 0])) as Record<Muscle, number>;
  for (const set of sets) {
    for (const muscle of MUSCLES) {
      const credit = creditFor(set, muscle);
      if (credit > 0) totals[muscle] += credit * MUSCLE_XP_PER_SET;
    }
  }
  return totals;
}
