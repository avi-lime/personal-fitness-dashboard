import { creditFor, type ResolvedSet } from "./history";
import { MUSCLES, MUSCLE_META, type Muscle } from "./muscles";
import { addDays, diffInDays, type LocalDate } from "@/lib/date";

/**
 * How each muscle is doing right now: still recovering, ready, overdue, or
 * left alone so long it needs attention.
 *
 *  recovering — worked hard recently enough that training it again now
 *               mostly adds fatigue. "Needs rest."
 *  ready      — recovered, and trained within the last few days.
 *  due        — recovered and not trained for 5+ days.
 *  neglected  — not trained for 10+ days, or never.
 *
 * Separately, `underVolume` flags a recovered muscle that has had less than
 * half its weekly set target in the last seven days.
 */
export type MuscleState = "recovering" | "ready" | "due" | "neglected";

export const DUE_AFTER_DAYS = 5;
export const NEGLECTED_AFTER_DAYS = 10;

export interface MuscleStatus {
  muscle: Muscle;
  state: MuscleState;
  lastTrained: LocalDate | null;
  daysSince: number | null;
  /** 0–1. 1 once fully recovered. */
  recovery: number;
  /** When it will be fully recovered; null if it already is. */
  readyAt: Date | null;
  /** Effective sets in the last 7 days (primary 1, secondary 0.5). */
  weeklySets: number;
  weeklyTarget: number;
  underVolume: boolean;
  needsAttention: boolean;
  /** Higher = more in need. Orders the attention list. */
  attentionScore: number;
}

/**
 * A light session recovers faster than a brutal one. Six hard sets is taken
 * as a full session; fewer scale the base time down, never below a third.
 */
export function recoveryHoursFor(muscle: Muscle, effectiveSets: number): number {
  const base = MUSCLE_META[muscle].recoveryHours;
  return base * Math.min(1, Math.max(0.35, effectiveSets / 6));
}

export function computeMuscleStatus(
  sets: readonly ResolvedSet[],
  today: LocalDate,
  now: Date,
): MuscleStatus[] {
  const weekStart = addDays(today, -6);

  return MUSCLES.map((muscle) => {
    // Per session: when it happened and how much work this muscle did.
    const sessions = new Map<string, { trainedAt: Date; date: LocalDate; sets: number }>();
    let weeklySets = 0;
    let lastTrained: LocalDate | null = null;

    for (const set of sets) {
      const credit = creditFor(set, muscle);
      if (credit === 0) continue;
      if (set.date > today) continue;
      const session = sessions.get(set.workoutId) ?? { trainedAt: set.trainedAt, date: set.date, sets: 0 };
      session.sets += credit;
      sessions.set(set.workoutId, session);
      if (set.date >= weekStart) weeklySets += credit;
      if (!lastTrained || set.date > lastTrained) lastTrained = set.date;
    }

    // Recovery is set by whichever recent session will take longest to clear.
    let readyAt: Date | null = null;
    let window = 0;
    for (const session of sessions.values()) {
      const hours = recoveryHoursFor(muscle, session.sets);
      const clears = new Date(session.trainedAt.getTime() + hours * 3_600_000);
      if (clears > now && (!readyAt || clears > readyAt)) {
        readyAt = clears;
        window = hours;
      }
    }
    const recovery = readyAt
      ? Math.max(0, Math.min(1, 1 - (readyAt.getTime() - now.getTime()) / (window * 3_600_000)))
      : 1;

    const daysSince = lastTrained ? diffInDays(lastTrained, today) : null;
    const weeklyTarget = MUSCLE_META[muscle].weeklySetTarget;
    const state: MuscleState = readyAt
      ? "recovering"
      : daysSince === null || daysSince >= NEGLECTED_AFTER_DAYS
        ? "neglected"
        : daysSince >= DUE_AFTER_DAYS
          ? "due"
          : "ready";
    const underVolume = state !== "recovering" && weeklySets < weeklyTarget / 2;
    const needsAttention = state === "due" || state === "neglected" || underVolume;

    const deficit = Math.max(0, 1 - weeklySets / weeklyTarget);
    const attentionScore = !needsAttention
      ? 0
      : (state === "neglected" ? 3 : state === "due" ? 2 : 1) +
        deficit +
        // Big muscles first when everything else is equal: they matter more.
        weeklyTarget / 100;

    return {
      muscle,
      state,
      lastTrained,
      daysSince,
      recovery,
      readyAt,
      weeklySets: Math.round(weeklySets * 10) / 10,
      weeklyTarget,
      underVolume,
      needsAttention,
      attentionScore,
    };
  });
}

/** Most in need first. */
export function attentionList(statuses: readonly MuscleStatus[]): MuscleStatus[] {
  return statuses
    .filter((status) => status.needsAttention)
    .sort((a, b) => b.attentionScore - a.attentionScore);
}

/** Least recovered first. */
export function restList(statuses: readonly MuscleStatus[]): MuscleStatus[] {
  return statuses.filter((status) => status.state === "recovering").sort((a, b) => a.recovery - b.recovery);
}
