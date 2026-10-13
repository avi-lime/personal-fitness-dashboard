import type { Muscle } from "./muscles";

/**
 * Training programs: a rotation of days, each a list of movement slots.
 *
 * A slot names what the day needs ("a horizontal press") and an ordered list
 * of exercises that fill it, best first. The planner picks the first one the
 * user's equipment allows — or the one they have been doing, so progress
 * carries over — which is how one program serves a full gym and a bedroom.
 */
export const PROGRAM_KEYS = ["ppl", "push_pull"] as const;
export type ProgramKey = (typeof PROGRAM_KEYS)[number];

export const DAY_KEYS = ["push", "pull", "legs"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export interface Slot {
  label: string;
  /** Exercise keys, most preferred first. */
  options: string[];
  sets: number;
  /** Dropped rather than substituted when nothing fits the equipment. */
  optional?: boolean;
}

export interface ProgramDay {
  key: DayKey;
  label: string;
  /** The muscles this day exists to train — used to judge whether it is ready. */
  focus: Muscle[];
  slots: Slot[];
}

export interface Program {
  key: ProgramKey;
  name: string;
  summary: string;
  /** Sessions per week this program is designed around. */
  suggestedDays: number[];
  days: ProgramDay[];
}

const PUSH_PRESS = ["barbell-bench-press", "dumbbell-bench-press", "machine-chest-press", "push-up"];
const VERTICAL_PRESS = ["overhead-press", "dumbbell-shoulder-press", "machine-shoulder-press", "pike-push-up"];
const INCLINE_PRESS = ["incline-dumbbell-press", "incline-barbell-bench-press", "dip"];
const CHEST_ISO = ["cable-fly", "pec-deck", "dumbbell-fly", "dip", "push-up"];
const SIDE_DELTS = ["lateral-raise", "cable-lateral-raise"];
const TRICEPS = ["triceps-pushdown", "overhead-triceps-extension", "skull-crusher", "diamond-push-up"];
const VERTICAL_PULL = ["lat-pulldown", "pull-up", "chin-up", "inverted-row"];
const HEAVY_ROW = ["barbell-row", "seated-cable-row", "chest-supported-row", "dumbbell-row", "inverted-row"];
const SECOND_ROW = ["dumbbell-row", "seated-cable-row", "chest-supported-row", "inverted-row"];
const REAR_DELTS = ["face-pull", "reverse-fly"];
const BICEPS = ["barbell-curl", "dumbbell-curl", "cable-curl", "chin-up"];
const BICEPS_2 = ["hammer-curl", "incline-dumbbell-curl"];
const SQUAT = ["back-squat", "leg-press", "hack-squat", "goblet-squat", "bulgarian-split-squat", "bodyweight-squat"];
const HINGE = ["romanian-deadlift", "hip-thrust", "back-extension"];
const SINGLE_LEG = ["bulgarian-split-squat", "lunge"];
const HAMSTRING_ISO = ["leg-curl"];
const QUAD_ISO = ["leg-extension"];
const CALVES = ["calf-raise"];
const CORE = ["hanging-leg-raise", "cable-crunch", "ab-wheel", "crunch", "plank"];

export const PROGRAMS: Record<ProgramKey, Program> = {
  ppl: {
    key: "ppl",
    name: "Push / Pull / Legs",
    summary:
      "Three days in rotation. Run it 3×/week to hit everything once, or 6×/week to hit everything twice — the classic split for building muscle.",
    suggestedDays: [3, 5, 6],
    days: [
      {
        key: "push",
        label: "Push",
        focus: ["chest", "front_delts", "side_delts", "triceps"],
        slots: [
          { label: "Horizontal press", options: PUSH_PRESS, sets: 4 },
          { label: "Vertical press", options: VERTICAL_PRESS, sets: 3 },
          { label: "Incline press", options: INCLINE_PRESS, sets: 3 },
          { label: "Chest isolation", options: CHEST_ISO, sets: 2, optional: true },
          { label: "Side delts", options: SIDE_DELTS, sets: 4 },
          { label: "Triceps", options: TRICEPS, sets: 3 },
        ],
      },
      {
        key: "pull",
        label: "Pull",
        focus: ["lats", "upper_back", "rear_delts", "biceps"],
        slots: [
          { label: "Vertical pull", options: VERTICAL_PULL, sets: 4 },
          { label: "Heavy row", options: HEAVY_ROW, sets: 3 },
          { label: "Second row", options: SECOND_ROW, sets: 3, optional: true },
          { label: "Rear delts", options: REAR_DELTS, sets: 3, optional: true },
          { label: "Biceps", options: BICEPS, sets: 3 },
          { label: "Biceps & forearms", options: BICEPS_2, sets: 2 },
        ],
      },
      {
        key: "legs",
        label: "Legs",
        focus: ["quads", "hamstrings", "glutes", "calves"],
        slots: [
          { label: "Squat", options: SQUAT, sets: 4 },
          { label: "Hinge", options: HINGE, sets: 3 },
          { label: "Single leg", options: SINGLE_LEG, sets: 2, optional: true },
          { label: "Hamstrings", options: HAMSTRING_ISO, sets: 3, optional: true },
          { label: "Quads", options: QUAD_ISO, sets: 2, optional: true },
          { label: "Calves", options: CALVES, sets: 4 },
          { label: "Core", options: CORE, sets: 3 },
        ],
      },
    ],
  },
  push_pull: {
    key: "push_pull",
    name: "Push / Pull",
    summary:
      "Two days in rotation, with legs folded in: squats on push day, hinges on pull day. Fits 2–4 sessions a week; at 4, every muscle gets trained twice.",
    suggestedDays: [2, 3, 4],
    days: [
      {
        key: "push",
        label: "Push",
        focus: ["chest", "front_delts", "side_delts", "triceps", "quads"],
        slots: [
          { label: "Squat", options: SQUAT, sets: 3 },
          { label: "Horizontal press", options: PUSH_PRESS, sets: 3 },
          { label: "Vertical press", options: VERTICAL_PRESS, sets: 3 },
          { label: "Incline press", options: INCLINE_PRESS, sets: 2, optional: true },
          { label: "Side delts", options: SIDE_DELTS, sets: 3 },
          { label: "Triceps", options: TRICEPS, sets: 3 },
          { label: "Calves", options: CALVES, sets: 3 },
        ],
      },
      {
        key: "pull",
        label: "Pull",
        focus: ["lats", "upper_back", "biceps", "hamstrings", "glutes"],
        slots: [
          { label: "Hinge", options: ["romanian-deadlift", "deadlift", "hip-thrust", "back-extension"], sets: 3 },
          { label: "Vertical pull", options: VERTICAL_PULL, sets: 3 },
          { label: "Heavy row", options: HEAVY_ROW, sets: 3 },
          { label: "Hamstrings", options: HAMSTRING_ISO, sets: 2, optional: true },
          { label: "Rear delts", options: REAR_DELTS, sets: 3, optional: true },
          { label: "Biceps", options: BICEPS, sets: 3 },
          { label: "Core", options: CORE, sets: 3 },
        ],
      },
    ],
  },
};

export function isProgramKey(value: unknown): value is ProgramKey {
  return typeof value === "string" && (PROGRAM_KEYS as readonly string[]).includes(value);
}

export function isDayKey(value: unknown): value is DayKey {
  return typeof value === "string" && (DAY_KEYS as readonly string[]).includes(value);
}

/** Small muscles that can join any day without wrecking the split. */
export const TOP_UP_EXERCISES: Partial<Record<Muscle, string[]>> = {
  abs: ["hanging-leg-raise", "cable-crunch", "crunch", "plank"],
  obliques: ["side-plank", "russian-twist"],
  calves: ["calf-raise"],
  forearms: ["hammer-curl"],
  rear_delts: ["face-pull", "reverse-fly"],
  side_delts: ["lateral-raise", "cable-lateral-raise"],
};
