/**
 * The muscles the app tracks.
 *
 * A closed list rather than a table, for the same reason as `AREA_KEYS`: every
 * exercise, status, mission and tool schema can name a muscle as an enum, and
 * a body map needs to know in advance which regions exist. Granularity is the
 * level a lifter actually reasons about — "side delts are lagging", not
 * "lateral head of the deltoid".
 */
export const MUSCLES = [
  "chest",
  "front_delts",
  "side_delts",
  "rear_delts",
  "triceps",
  "biceps",
  "forearms",
  "lats",
  "upper_back",
  "lower_back",
  "abs",
  "obliques",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export function isMuscle(value: unknown): value is Muscle {
  return typeof value === "string" && (MUSCLES as readonly string[]).includes(value);
}

/** The broad groups a week should touch, and that the body map colours by. */
export const MUSCLE_GROUPS = ["chest", "back", "shoulders", "arms", "core", "legs"] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export interface MuscleMeta {
  label: string;
  group: MuscleGroup;
  /**
   * Hours to recover from a full session (≈6 hard sets). Big muscles that take
   * heavy compound loading need longer; small ones bounce back faster. A light
   * session scales this down — see `recoveryHoursFor` in status.ts.
   */
  recoveryHours: number;
  /**
   * Hard sets per week worth aiming for when building muscle. Front delts and
   * lower back are low on purpose: pressing and hinging already load them.
   */
  weeklySetTarget: number;
}

export const MUSCLE_META: Record<Muscle, MuscleMeta> = {
  chest: { label: "Chest", group: "chest", recoveryHours: 72, weeklySetTarget: 12 },
  front_delts: { label: "Front delts", group: "shoulders", recoveryHours: 48, weeklySetTarget: 4 },
  side_delts: { label: "Side delts", group: "shoulders", recoveryHours: 48, weeklySetTarget: 10 },
  rear_delts: { label: "Rear delts", group: "shoulders", recoveryHours: 48, weeklySetTarget: 8 },
  triceps: { label: "Triceps", group: "arms", recoveryHours: 48, weeklySetTarget: 8 },
  biceps: { label: "Biceps", group: "arms", recoveryHours: 48, weeklySetTarget: 8 },
  forearms: { label: "Forearms", group: "arms", recoveryHours: 36, weeklySetTarget: 4 },
  lats: { label: "Lats", group: "back", recoveryHours: 72, weeklySetTarget: 12 },
  upper_back: { label: "Upper back", group: "back", recoveryHours: 48, weeklySetTarget: 10 },
  lower_back: { label: "Lower back", group: "back", recoveryHours: 72, weeklySetTarget: 4 },
  abs: { label: "Abs", group: "core", recoveryHours: 36, weeklySetTarget: 8 },
  obliques: { label: "Obliques", group: "core", recoveryHours: 36, weeklySetTarget: 4 },
  quads: { label: "Quads", group: "legs", recoveryHours: 72, weeklySetTarget: 12 },
  hamstrings: { label: "Hamstrings", group: "legs", recoveryHours: 72, weeklySetTarget: 10 },
  glutes: { label: "Glutes", group: "legs", recoveryHours: 72, weeklySetTarget: 8 },
  calves: { label: "Calves", group: "legs", recoveryHours: 36, weeklySetTarget: 8 },
};

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  legs: "Legs",
};

export function musclesInGroup(group: MuscleGroup): Muscle[] {
  return MUSCLES.filter((muscle) => MUSCLE_META[muscle].group === group);
}

/**
 * Older workouts carry a free-text "muscle group". This turns the common ones
 * into muscles so that history still counts, without guessing at anything
 * ambiguous: an unknown string maps to nothing rather than to a wrong muscle.
 */
const LEGACY_GROUPS: Record<string, Muscle[]> = {
  chest: ["chest"],
  pecs: ["chest"],
  back: ["lats", "upper_back"],
  lats: ["lats"],
  traps: ["upper_back"],
  "upper back": ["upper_back"],
  "lower back": ["lower_back"],
  shoulders: ["front_delts", "side_delts"],
  shoulder: ["front_delts", "side_delts"],
  delts: ["front_delts", "side_delts"],
  "rear delts": ["rear_delts"],
  biceps: ["biceps"],
  bicep: ["biceps"],
  triceps: ["triceps"],
  tricep: ["triceps"],
  arms: ["biceps", "triceps"],
  forearms: ["forearms"],
  abs: ["abs"],
  core: ["abs", "obliques"],
  obliques: ["obliques"],
  legs: ["quads", "hamstrings", "glutes"],
  quads: ["quads"],
  hamstrings: ["hamstrings"],
  hams: ["hamstrings"],
  glutes: ["glutes"],
  calves: ["calves"],
};

export function musclesFromLegacyGroup(value: string | null | undefined): Muscle[] {
  if (!value) return [];
  const key = value.trim().toLowerCase().replace(/_/g, " ");
  if (isMuscle(value.trim())) return [value.trim() as Muscle];
  return LEGACY_GROUPS[key] ?? [];
}
