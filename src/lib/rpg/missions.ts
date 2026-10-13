import { creditFor, type ResolvedSet } from "@/lib/fitness/history";
import { MUSCLE_GROUPS, MUSCLE_META, type Muscle, type MuscleGroup } from "@/lib/fitness/muscles";
import type { PersonalRecord } from "@/lib/fitness/progression";
import { attentionList, type MuscleStatus } from "@/lib/fitness/status";
import { formatValue } from "@/lib/format";
import { startOfWeek, type LocalDate } from "@/lib/date";
import type { SessionSummary } from "./xp";

/**
 * Missions: small, concrete things to do today and this week.
 *
 * They are generated, not stored. What a mission *asks* is fixed for its
 * period — the muscle a weekly mission targets is chosen from the state at
 * the start of the week, so it does not wander as you train. What it has
 * *achieved* is recomputed from history every time. The only stored thing
 * is the claim: claiming writes one ledger row, which is what pays the XP and
 * gold and what stops a mission being claimed twice.
 */
export type MissionScope = "daily" | "weekly";

export interface Mission {
  /** Unique within its period. */
  key: string;
  scope: MissionScope;
  /** The day (daily) or the Monday (weekly) it belongs to. */
  period: LocalDate;
  title: string;
  detail: string;
  progress: number;
  target: number;
  unit: string | null;
  xp: number;
  gold: number;
  complete: boolean;
  claimed: boolean;
}

export interface MissionContext {
  today: LocalDate;
  daysPerWeek: number;
  sets: readonly ResolvedSet[];
  sessions: readonly SessionSummary[];
  prs: readonly PersonalRecord[];
  /** Status from history before today. */
  statusesAtDayStart: readonly MuscleStatus[];
  /** Status from history before this Monday. */
  statusesAtWeekStart: readonly MuscleStatus[];
  protein: number;
  proteinTarget: number | null;
  sleepHours: number;
  /** `${key}@${period}` for every claimed mission. */
  claimed: ReadonlySet<string>;
}

export const claimId = (key: string, period: LocalDate) => `${key}@${period}`;

function mission(
  context: MissionContext,
  entry: Omit<Mission, "complete" | "claimed" | "progress"> & { progress: number },
): Mission {
  const progress = Math.max(0, Math.round(entry.progress * 10) / 10);
  return {
    ...entry,
    progress: Math.min(progress, entry.target),
    complete: progress >= entry.target,
    claimed: context.claimed.has(claimId(entry.key, entry.period)),
  };
}

function creditOn(sets: readonly ResolvedSet[], muscle: Muscle): number {
  return sets.reduce((total, set) => total + creditFor(set, muscle), 0);
}

/** The muscle a week should focus on: furthest behind its target going in. */
export function weeklyFocusMuscle(statuses: readonly MuscleStatus[]): Muscle | null {
  const candidates = statuses
    .filter((status) => status.weeklyTarget >= 8)
    .sort(
      (a, b) =>
        a.weeklySets / a.weeklyTarget - b.weeklySets / b.weeklyTarget ||
        b.attentionScore - a.attentionScore,
    );
  return candidates[0]?.muscle ?? null;
}

export function computeMissions(context: MissionContext): Mission[] {
  const { today } = context;
  const week = startOfWeek(today);
  const todaySets = context.sets.filter((set) => set.date === today);
  const weekSets = context.sets.filter((set) => set.date >= week && set.date <= today);
  const completed = context.sessions.filter((session) => session.completed);
  const sessionsBeforeToday = completed.filter((session) => session.date >= week && session.date < today).length;
  const sessionsThisWeek = completed.filter((session) => session.date >= week && session.date <= today).length;

  const missions: Mission[] = [];

  // --- Daily ---------------------------------------------------------------
  if (sessionsBeforeToday < context.daysPerWeek) {
    missions.push(
      mission(context, {
        key: "daily-session",
        scope: "daily",
        period: today,
        title: "Train today",
        detail: "Finish a session.",
        progress: completed.some((session) => session.date === today) ? 1 : 0,
        target: 1,
        unit: null,
        xp: 40,
        gold: 10,
      }),
    );
  } else {
    missions.push(
      mission(context, {
        key: "daily-recover",
        scope: "daily",
        period: today,
        title: "Recover",
        detail: `This week's ${context.daysPerWeek} sessions are done. Sleep 7 hours and let it work.`,
        progress: context.sleepHours,
        target: 7,
        unit: "h",
        xp: 30,
        gold: 10,
      }),
    );
  }

  if (context.proteinTarget && context.proteinTarget > 0) {
    missions.push(
      mission(context, {
        key: "daily-protein",
        scope: "daily",
        period: today,
        title: "Feed the muscle",
        detail: `Hit ${formatValue(context.proteinTarget)} g of protein.`,
        progress: context.protein,
        target: context.proteinTarget,
        unit: "g",
        xp: 30,
        gold: 10,
      }),
    );
  }

  const lagging = attentionList(context.statusesAtDayStart)[0];
  if (lagging && sessionsBeforeToday < context.daysPerWeek) {
    const label = MUSCLE_META[lagging.muscle].label;
    missions.push(
      mission(context, {
        key: `daily-attention-${lagging.muscle}`,
        scope: "daily",
        period: today,
        title: `${label} needs you`,
        detail:
          lagging.daysSince === null
            ? `${label} has no training on record. Give it three sets.`
            : `${label} is ${lagging.daysSince} days untrained. Give it three sets.`,
        progress: creditOn(todaySets, lagging.muscle),
        target: 3,
        unit: "sets",
        xp: 30,
        gold: 15,
      }),
    );
  }

  // --- Weekly --------------------------------------------------------------
  missions.push(
    mission(context, {
      key: "weekly-sessions",
      scope: "weekly",
      period: week,
      title: `Train ${context.daysPerWeek}× this week`,
      detail: "Consistency beats intensity.",
      progress: sessionsThisWeek,
      target: context.daysPerWeek,
      unit: "sessions",
      xp: 150,
      gold: 50,
    }),
  );

  const groups = new Set<MuscleGroup>();
  for (const set of weekSets) for (const muscle of set.primary) groups.add(MUSCLE_META[muscle].group);
  missions.push(
    mission(context, {
      key: "weekly-coverage",
      scope: "weekly",
      period: week,
      title: "Leave nothing out",
      detail: "Train chest, back, shoulders, arms, core and legs this week.",
      progress: groups.size,
      target: MUSCLE_GROUPS.length,
      unit: "groups",
      xp: 120,
      gold: 40,
    }),
  );

  missions.push(
    mission(context, {
      key: "weekly-pr",
      scope: "weekly",
      period: week,
      title: "Beat your best",
      detail: "Set a personal record on any lift.",
      progress: context.prs.filter((record) => record.date >= week && record.date <= today).length,
      target: 1,
      unit: null,
      xp: 100,
      gold: 30,
    }),
  );

  const focus = weeklyFocusMuscle(context.statusesAtWeekStart);
  if (focus) {
    const target = MUSCLE_META[focus].weeklySetTarget;
    missions.push(
      mission(context, {
        key: `weekly-focus-${focus}`,
        scope: "weekly",
        period: week,
        title: `${MUSCLE_META[focus].label} focus`,
        detail: `Your most lagging muscle going into the week. Get it ${target} sets.`,
        progress: creditOn(weekSets, focus),
        target,
        unit: "sets",
        xp: 100,
        gold: 40,
      }),
    );
  }

  return missions;
}
