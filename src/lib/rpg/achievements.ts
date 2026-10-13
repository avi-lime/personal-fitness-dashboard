import type { ResolvedSet } from "@/lib/fitness/history";
import { MUSCLE_GROUPS, MUSCLE_META, type MuscleGroup } from "@/lib/fitness/muscles";
import type { PersonalRecord } from "@/lib/fitness/progression";
import { startOfWeek, addDays, type LocalDate } from "@/lib/date";
import type { SessionSummary } from "./xp";

/**
 * Badges. Derived from history like XP, so they unlock on their own the
 * moment the work is done — and the day they unlocked is known, because the
 * history says when the threshold was crossed.
 */
export interface Achievement {
  key: string;
  title: string;
  description: string;
  xp: number;
  progress: number;
  target: number;
  unlocked: boolean;
  unlockedOn: LocalDate | null;
}

interface Context {
  sets: readonly ResolvedSet[];
  sessions: readonly SessionSummary[];
  prs: readonly PersonalRecord[];
}

const LEG_MUSCLES = new Set(["quads", "hamstrings", "glutes"]);

/** Date the Nth item happened on, given a chronological list of dates. */
function nth(dates: readonly LocalDate[], count: number): LocalDate | null {
  return dates.length >= count ? dates[count - 1] : null;
}

function counted(key: string, title: string, description: string, xp: number, dates: LocalDate[], target: number): Achievement {
  const unlockedOn = nth(dates, target);
  return { key, title, description, xp, target, progress: Math.min(dates.length, target), unlocked: unlockedOn !== null, unlockedOn };
}

function groupOf(set: ResolvedSet): Set<MuscleGroup> {
  return new Set(set.primary.map((muscle) => MUSCLE_META[muscle].group));
}

export function computeAchievements({ sets, sessions, prs }: Context): Achievement[] {
  const completed = sessions.filter((session) => session.completed).map((session) => session.date);
  const setDates = sets.map((set) => set.date);
  const prDates = prs.map((record) => record.date);

  // Leg days: completed sessions with at least four sets aimed at the legs.
  const legSets = new Map<string, number>();
  for (const set of sets) {
    if (set.primary.some((muscle) => LEG_MUSCLES.has(muscle))) {
      legSets.set(set.workoutId, (legSets.get(set.workoutId) ?? 0) + 1);
    }
  }
  const legDays = sessions
    .filter((session) => session.completed && (legSets.get(session.workoutId) ?? 0) >= 4)
    .map((session) => session.date);

  // Balanced week: one Monday-to-Sunday week that touched every group.
  const weeks = new Map<LocalDate, Map<MuscleGroup, LocalDate>>();
  for (const set of sets) {
    const week = startOfWeek(set.date);
    const hit = weeks.get(week) ?? new Map<MuscleGroup, LocalDate>();
    for (const group of groupOf(set)) if (!hit.has(group)) hit.set(group, set.date);
    weeks.set(week, hit);
  }
  let balancedOn: LocalDate | null = null;
  let bestCoverage = 0;
  for (const hit of [...weeks.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, value]) => value)) {
    bestCoverage = Math.max(bestCoverage, hit.size);
    if (!balancedOn && hit.size === MUSCLE_GROUPS.length) {
      balancedOn = [...hit.values()].sort().at(-1) ?? null;
    }
  }

  // Four consecutive weeks of at least three completed sessions.
  const perWeek = new Map<LocalDate, LocalDate[]>();
  for (const date of completed) {
    const week = startOfWeek(date);
    perWeek.set(week, [...(perWeek.get(week) ?? []), date]);
  }
  let streakOn: LocalDate | null = null;
  let bestRun = 0;
  const ordered = [...perWeek.keys()].sort();
  let run = 0;
  let previous: LocalDate | null = null;
  for (const week of ordered) {
    const enough = (perWeek.get(week)?.length ?? 0) >= 3;
    run = enough ? (previous && addDays(previous, 7) === week ? run + 1 : 1) : 0;
    previous = enough ? week : null;
    bestRun = Math.max(bestRun, run);
    if (!streakOn && run >= 4) streakOn = perWeek.get(week)![2];
  }

  return [
    counted("first-session", "First rep", "Finish your first session.", 50, completed, 1),
    counted("sessions-10", "Regular", "Finish 10 sessions.", 100, completed, 10),
    counted("sessions-50", "Committed", "Finish 50 sessions.", 300, completed, 50),
    counted("sessions-100", "Iron habit", "Finish 100 sessions.", 600, completed, 100),
    counted("sets-100", "Hundred sets", "Complete 100 working sets.", 100, setDates, 100),
    counted("sets-1000", "Thousand sets", "Complete 1,000 working sets.", 500, setDates, 1000),
    counted("first-pr", "New best", "Beat a previous best on any lift.", 50, prDates, 1),
    counted("prs-10", "Record breaker", "Set 10 personal records.", 200, prDates, 10),
    counted("leg-days-10", "Never skips leg day", "Ten sessions with real leg work in them.", 200, legDays, 10),
    {
      key: "balanced-week",
      title: "Balanced",
      description: "Train every muscle group in a single week.",
      xp: 150,
      target: MUSCLE_GROUPS.length,
      progress: Math.min(bestCoverage, MUSCLE_GROUPS.length),
      unlocked: balancedOn !== null,
      unlockedOn: balancedOn,
    },
    {
      key: "streak-4",
      title: "Four-week streak",
      description: "Three or more sessions a week, four weeks running.",
      xp: 300,
      target: 4,
      progress: Math.min(bestRun, 4),
      unlocked: streakOn !== null,
      unlockedOn: streakOn,
    },
  ];
}

export function achievementXp(achievements: readonly Achievement[]): number {
  return achievements.filter((entry) => entry.unlocked).reduce((total, entry) => total + entry.xp, 0);
}
