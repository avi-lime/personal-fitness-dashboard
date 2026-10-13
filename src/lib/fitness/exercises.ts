import { musclesFromLegacyGroup, type Muscle } from "./muscles";

/**
 * The exercise library: every movement the planner can prescribe, and the
 * muscles each one trains.
 *
 * Code rather than a table, so the planner, the muscle map and the tool
 * schemas share one definition and a typo in a muscle name fails the build.
 * A movement outside the library still works — it is logged by name, and
 * counts toward a muscle if the user picks one for it.
 */
export type Equipment = "barbell" | "dumbbell" | "cable" | "machine" | "bodyweight";
export type MovementPattern = "push" | "pull" | "legs" | "core";
export type Measure = "reps" | "time";

export interface ExerciseDef {
  key: string;
  name: string;
  /** Other names people type, matched case- and punctuation-insensitively. */
  aliases: string[];
  pattern: MovementPattern;
  /** Any one of these is enough to do it. */
  equipment: Equipment[];
  /** Full credit for volume and recovery. */
  primary: Muscle[];
  /** Half credit: it works, but it is not the point of the lift. */
  secondary: Muscle[];
  compound: boolean;
  measure: Measure;
  /** Reps per set, or seconds for timed holds. */
  range: [number, number];
  restSeconds: number;
  /** kg added when every set reaches the top of the range. 0 = progress by reps. */
  increment: number;
}

type Def = Omit<ExerciseDef, "measure" | "increment" | "aliases" | "secondary"> &
  Partial<Pick<ExerciseDef, "measure" | "increment" | "aliases" | "secondary">>;

function def(entry: Def): ExerciseDef {
  const bodyweightOnly = entry.equipment.length === 1 && entry.equipment[0] === "bodyweight";
  return {
    aliases: [],
    secondary: [],
    measure: "reps",
    increment: bodyweightOnly ? 0 : entry.equipment.includes("barbell") ? 2.5 : entry.compound ? 2 : 1,
    ...entry,
  };
}

export const EXERCISES: readonly ExerciseDef[] = [
  // --- Push ----------------------------------------------------------------
  def({ key: "barbell-bench-press", name: "Bench press", aliases: ["bench", "flat bench", "bb bench", "barbell bench press", "flat bench press"], pattern: "push", equipment: ["barbell"], primary: ["chest"], secondary: ["front_delts", "triceps"], compound: true, range: [6, 10], restSeconds: 150 }),
  def({ key: "incline-barbell-bench-press", name: "Incline bench press", aliases: ["incline bench", "incline barbell press", "incline bb press"], pattern: "push", equipment: ["barbell"], primary: ["chest"], secondary: ["front_delts", "triceps"], compound: true, range: [6, 10], restSeconds: 150 }),
  def({ key: "dumbbell-bench-press", name: "Dumbbell bench press", aliases: ["db bench", "db press", "dumbbell press", "db bench press", "flat db press", "flat dumbbell press"], pattern: "push", equipment: ["dumbbell"], primary: ["chest"], secondary: ["front_delts", "triceps"], compound: true, range: [8, 12], restSeconds: 120 }),
  def({ key: "incline-dumbbell-press", name: "Incline dumbbell press", aliases: ["incline db press", "incline dumbbell bench press", "incline db bench"], pattern: "push", equipment: ["dumbbell"], primary: ["chest"], secondary: ["front_delts", "triceps"], compound: true, range: [8, 12], restSeconds: 120 }),
  def({ key: "machine-chest-press", name: "Machine chest press", aliases: ["chest press", "chest press machine", "seated chest press"], pattern: "push", equipment: ["machine"], primary: ["chest"], secondary: ["front_delts", "triceps"], compound: true, range: [8, 12], restSeconds: 120 }),
  def({ key: "push-up", name: "Push-up", aliases: ["pushup", "pushups", "push ups", "press up"], pattern: "push", equipment: ["bodyweight"], primary: ["chest"], secondary: ["front_delts", "triceps", "abs"], compound: true, range: [10, 20], restSeconds: 90 }),
  def({ key: "dip", name: "Dips", aliases: ["dip", "chest dips", "parallel bar dips"], pattern: "push", equipment: ["bodyweight"], primary: ["chest", "triceps"], secondary: ["front_delts"], compound: true, range: [6, 12], restSeconds: 120 }),
  def({ key: "cable-fly", name: "Cable fly", aliases: ["cable flyes", "cable flies", "cable crossover", "cable crossovers"], pattern: "push", equipment: ["cable"], primary: ["chest"], compound: false, range: [12, 15], restSeconds: 75 }),
  def({ key: "pec-deck", name: "Pec deck", aliases: ["machine fly", "pec fly", "pec deck fly", "butterfly"], pattern: "push", equipment: ["machine"], primary: ["chest"], compound: false, range: [12, 15], restSeconds: 75 }),
  def({ key: "dumbbell-fly", name: "Dumbbell fly", aliases: ["db fly", "dumbbell flyes", "dumbbell flies", "db flyes"], pattern: "push", equipment: ["dumbbell"], primary: ["chest"], compound: false, range: [10, 15], restSeconds: 75 }),
  def({ key: "overhead-press", name: "Overhead press", aliases: ["ohp", "military press", "standing press", "barbell shoulder press", "shoulder press barbell"], pattern: "push", equipment: ["barbell"], primary: ["front_delts"], secondary: ["side_delts", "triceps", "upper_back"], compound: true, range: [6, 10], restSeconds: 150 }),
  def({ key: "dumbbell-shoulder-press", name: "Dumbbell shoulder press", aliases: ["db shoulder press", "seated dumbbell press", "seated db press", "shoulder press", "dumbbell overhead press"], pattern: "push", equipment: ["dumbbell"], primary: ["front_delts"], secondary: ["side_delts", "triceps"], compound: true, range: [8, 12], restSeconds: 120 }),
  def({ key: "machine-shoulder-press", name: "Machine shoulder press", aliases: ["shoulder press machine"], pattern: "push", equipment: ["machine"], primary: ["front_delts"], secondary: ["side_delts", "triceps"], compound: true, range: [8, 12], restSeconds: 120 }),
  def({ key: "pike-push-up", name: "Pike push-up", aliases: ["pike pushup", "pike pushups", "pike press"], pattern: "push", equipment: ["bodyweight"], primary: ["front_delts"], secondary: ["triceps", "side_delts"], compound: true, range: [6, 12], restSeconds: 90 }),
  def({ key: "lateral-raise", name: "Lateral raise", aliases: ["lateral raises", "side raise", "side raises", "side lateral raise", "db lateral raise", "dumbbell lateral raise"], pattern: "push", equipment: ["dumbbell"], primary: ["side_delts"], compound: false, range: [12, 20], restSeconds: 60 }),
  def({ key: "cable-lateral-raise", name: "Cable lateral raise", aliases: ["cable side raise"], pattern: "push", equipment: ["cable"], primary: ["side_delts"], compound: false, range: [12, 20], restSeconds: 60 }),
  def({ key: "triceps-pushdown", name: "Triceps pushdown", aliases: ["tricep pushdown", "rope pushdown", "pushdown", "pushdowns", "cable pushdown", "tricep pushdowns"], pattern: "push", equipment: ["cable"], primary: ["triceps"], compound: false, range: [10, 15], restSeconds: 60 }),
  def({ key: "overhead-triceps-extension", name: "Overhead triceps extension", aliases: ["overhead extension", "tricep extension", "triceps extension", "overhead tricep extension", "french press", "overhead cable extension"], pattern: "push", equipment: ["cable", "dumbbell"], primary: ["triceps"], compound: false, range: [10, 15], restSeconds: 60 }),
  def({ key: "skull-crusher", name: "Skull crusher", aliases: ["skull crushers", "skullcrusher", "lying triceps extension", "lying tricep extension"], pattern: "push", equipment: ["barbell", "dumbbell"], primary: ["triceps"], compound: false, range: [8, 12], restSeconds: 75 }),
  def({ key: "close-grip-bench-press", name: "Close-grip bench press", aliases: ["close grip bench", "cgbp"], pattern: "push", equipment: ["barbell"], primary: ["triceps"], secondary: ["chest", "front_delts"], compound: true, range: [6, 10], restSeconds: 120 }),
  def({ key: "diamond-push-up", name: "Diamond push-up", aliases: ["diamond pushup", "diamond pushups", "close grip push up"], pattern: "push", equipment: ["bodyweight"], primary: ["triceps"], secondary: ["chest", "front_delts"], compound: true, range: [8, 15], restSeconds: 75 }),

  // --- Pull ----------------------------------------------------------------
  def({ key: "deadlift", name: "Deadlift", aliases: ["deadlifts", "conventional deadlift", "barbell deadlift", "dl"], pattern: "pull", equipment: ["barbell"], primary: ["hamstrings", "glutes", "lower_back"], secondary: ["upper_back", "lats", "forearms", "quads"], compound: true, range: [3, 6], restSeconds: 180, increment: 5 }),
  def({ key: "pull-up", name: "Pull-up", aliases: ["pullup", "pullups", "pull ups", "wide grip pull up"], pattern: "pull", equipment: ["bodyweight"], primary: ["lats"], secondary: ["biceps", "upper_back", "forearms"], compound: true, range: [4, 10], restSeconds: 150 }),
  def({ key: "chin-up", name: "Chin-up", aliases: ["chinup", "chinups", "chin ups"], pattern: "pull", equipment: ["bodyweight"], primary: ["lats", "biceps"], secondary: ["upper_back"], compound: true, range: [4, 10], restSeconds: 150 }),
  def({ key: "lat-pulldown", name: "Lat pulldown", aliases: ["pulldown", "pulldowns", "lat pull down", "lat pulldowns", "wide grip pulldown"], pattern: "pull", equipment: ["cable", "machine"], primary: ["lats"], secondary: ["biceps", "upper_back"], compound: true, range: [8, 12], restSeconds: 120 }),
  def({ key: "barbell-row", name: "Barbell row", aliases: ["bent over row", "bent-over row", "bb row", "pendlay row", "barbell rows"], pattern: "pull", equipment: ["barbell"], primary: ["upper_back", "lats"], secondary: ["biceps", "rear_delts", "lower_back"], compound: true, range: [6, 10], restSeconds: 150 }),
  def({ key: "dumbbell-row", name: "Dumbbell row", aliases: ["db row", "one arm row", "single arm row", "one arm dumbbell row", "single arm dumbbell row"], pattern: "pull", equipment: ["dumbbell"], primary: ["lats", "upper_back"], secondary: ["biceps", "rear_delts"], compound: true, range: [8, 12], restSeconds: 90 }),
  def({ key: "seated-cable-row", name: "Seated cable row", aliases: ["cable row", "seated row", "low row", "cable rows"], pattern: "pull", equipment: ["cable"], primary: ["upper_back", "lats"], secondary: ["biceps", "rear_delts"], compound: true, range: [8, 12], restSeconds: 120 }),
  def({ key: "chest-supported-row", name: "Chest-supported row", aliases: ["t bar row", "t-bar row", "machine row", "chest supported row"], pattern: "pull", equipment: ["machine"], primary: ["upper_back"], secondary: ["lats", "rear_delts", "biceps"], compound: true, range: [8, 12], restSeconds: 120 }),
  def({ key: "inverted-row", name: "Inverted row", aliases: ["bodyweight row", "australian pull up", "australian pullup"], pattern: "pull", equipment: ["bodyweight"], primary: ["upper_back", "lats"], secondary: ["biceps", "rear_delts"], compound: true, range: [8, 15], restSeconds: 90 }),
  def({ key: "face-pull", name: "Face pull", aliases: ["face pulls", "rope face pull"], pattern: "pull", equipment: ["cable"], primary: ["rear_delts"], secondary: ["upper_back"], compound: false, range: [12, 20], restSeconds: 60 }),
  def({ key: "reverse-fly", name: "Reverse fly", aliases: ["rear delt fly", "reverse pec deck", "bent over lateral raise", "rear delt raise", "reverse flyes"], pattern: "pull", equipment: ["dumbbell", "machine"], primary: ["rear_delts"], secondary: ["upper_back"], compound: false, range: [12, 20], restSeconds: 60 }),
  def({ key: "barbell-curl", name: "Barbell curl", aliases: ["bb curl", "ez bar curl", "ez curl", "straight bar curl", "barbell curls"], pattern: "pull", equipment: ["barbell"], primary: ["biceps"], secondary: ["forearms"], compound: false, range: [8, 12], restSeconds: 75, increment: 2.5 }),
  def({ key: "dumbbell-curl", name: "Dumbbell curl", aliases: ["db curl", "bicep curl", "biceps curl", "bicep curls", "alternating curl", "dumbbell curls"], pattern: "pull", equipment: ["dumbbell"], primary: ["biceps"], secondary: ["forearms"], compound: false, range: [10, 15], restSeconds: 60 }),
  def({ key: "hammer-curl", name: "Hammer curl", aliases: ["hammer curls"], pattern: "pull", equipment: ["dumbbell"], primary: ["biceps", "forearms"], compound: false, range: [10, 15], restSeconds: 60 }),
  def({ key: "incline-dumbbell-curl", name: "Incline dumbbell curl", aliases: ["incline curl", "incline curls"], pattern: "pull", equipment: ["dumbbell"], primary: ["biceps"], compound: false, range: [10, 15], restSeconds: 60 }),
  def({ key: "cable-curl", name: "Cable curl", aliases: ["cable curls", "cable bicep curl"], pattern: "pull", equipment: ["cable"], primary: ["biceps"], compound: false, range: [10, 15], restSeconds: 60 }),
  def({ key: "shrug", name: "Shrug", aliases: ["shrugs", "barbell shrug", "dumbbell shrug"], pattern: "pull", equipment: ["barbell", "dumbbell"], primary: ["upper_back"], secondary: ["forearms"], compound: false, range: [10, 15], restSeconds: 60 }),
  def({ key: "back-extension", name: "Back extension", aliases: ["back extensions", "hyperextension", "hyperextensions"], pattern: "pull", equipment: ["bodyweight", "machine"], primary: ["lower_back"], secondary: ["glutes", "hamstrings"], compound: false, range: [10, 15], restSeconds: 75, increment: 0 }),

  // --- Legs ----------------------------------------------------------------
  def({ key: "back-squat", name: "Squat", aliases: ["squats", "back squat", "barbell squat", "barbell back squat"], pattern: "legs", equipment: ["barbell"], primary: ["quads", "glutes"], secondary: ["hamstrings", "lower_back", "abs"], compound: true, range: [5, 8], restSeconds: 180 }),
  def({ key: "front-squat", name: "Front squat", aliases: ["front squats"], pattern: "legs", equipment: ["barbell"], primary: ["quads"], secondary: ["glutes", "abs", "upper_back"], compound: true, range: [6, 10], restSeconds: 150 }),
  def({ key: "leg-press", name: "Leg press", aliases: ["leg presses", "45 degree leg press"], pattern: "legs", equipment: ["machine"], primary: ["quads", "glutes"], secondary: ["hamstrings"], compound: true, range: [8, 12], restSeconds: 150, increment: 5 }),
  def({ key: "hack-squat", name: "Hack squat", aliases: ["hack squats", "machine hack squat"], pattern: "legs", equipment: ["machine"], primary: ["quads"], secondary: ["glutes"], compound: true, range: [8, 12], restSeconds: 150, increment: 5 }),
  def({ key: "goblet-squat", name: "Goblet squat", aliases: ["goblet squats", "dumbbell squat"], pattern: "legs", equipment: ["dumbbell"], primary: ["quads", "glutes"], secondary: ["abs"], compound: true, range: [10, 15], restSeconds: 90 }),
  def({ key: "bulgarian-split-squat", name: "Bulgarian split squat", aliases: ["split squat", "split squats", "bss", "rear foot elevated split squat", "bulgarian split squats"], pattern: "legs", equipment: ["dumbbell", "bodyweight"], primary: ["quads", "glutes"], secondary: ["hamstrings"], compound: true, range: [8, 12], restSeconds: 90 }),
  def({ key: "lunge", name: "Walking lunge", aliases: ["lunge", "lunges", "walking lunges", "dumbbell lunge", "dumbbell lunges"], pattern: "legs", equipment: ["dumbbell", "bodyweight"], primary: ["quads", "glutes"], secondary: ["hamstrings"], compound: true, range: [10, 12], restSeconds: 90 }),
  def({ key: "bodyweight-squat", name: "Bodyweight squat", aliases: ["air squat", "air squats", "bodyweight squats"], pattern: "legs", equipment: ["bodyweight"], primary: ["quads", "glutes"], compound: true, range: [15, 25], restSeconds: 60 }),
  def({ key: "romanian-deadlift", name: "Romanian deadlift", aliases: ["rdl", "rdls", "romanian deadlifts", "stiff leg deadlift", "dumbbell rdl"], pattern: "legs", equipment: ["barbell", "dumbbell"], primary: ["hamstrings", "glutes"], secondary: ["lower_back", "forearms"], compound: true, range: [8, 10], restSeconds: 150 }),
  def({ key: "leg-curl", name: "Leg curl", aliases: ["leg curls", "hamstring curl", "hamstring curls", "lying leg curl", "seated leg curl"], pattern: "legs", equipment: ["machine"], primary: ["hamstrings"], compound: false, range: [10, 15], restSeconds: 75 }),
  def({ key: "leg-extension", name: "Leg extension", aliases: ["leg extensions", "quad extension"], pattern: "legs", equipment: ["machine"], primary: ["quads"], compound: false, range: [10, 15], restSeconds: 75 }),
  def({ key: "hip-thrust", name: "Hip thrust", aliases: ["hip thrusts", "barbell hip thrust", "glute bridge", "glute bridges"], pattern: "legs", equipment: ["barbell", "bodyweight"], primary: ["glutes"], secondary: ["hamstrings"], compound: true, range: [8, 12], restSeconds: 120 }),
  def({ key: "calf-raise", name: "Calf raise", aliases: ["calf raises", "standing calf raise", "seated calf raise", "calves"], pattern: "legs", equipment: ["machine", "dumbbell", "bodyweight"], primary: ["calves"], compound: false, range: [10, 20], restSeconds: 60 }),

  // --- Core ----------------------------------------------------------------
  def({ key: "hanging-leg-raise", name: "Hanging leg raise", aliases: ["leg raise", "leg raises", "hanging knee raise", "hanging leg raises"], pattern: "core", equipment: ["bodyweight"], primary: ["abs"], secondary: ["obliques"], compound: false, range: [8, 15], restSeconds: 75 }),
  def({ key: "cable-crunch", name: "Cable crunch", aliases: ["cable crunches", "kneeling cable crunch"], pattern: "core", equipment: ["cable"], primary: ["abs"], compound: false, range: [10, 15], restSeconds: 60 }),
  def({ key: "crunch", name: "Crunch", aliases: ["crunches", "sit up", "sit ups", "situps"], pattern: "core", equipment: ["bodyweight"], primary: ["abs"], compound: false, range: [15, 25], restSeconds: 60 }),
  def({ key: "ab-wheel", name: "Ab wheel rollout", aliases: ["ab wheel", "ab rollout", "rollouts"], pattern: "core", equipment: ["bodyweight"], primary: ["abs"], secondary: ["obliques", "lats"], compound: false, range: [6, 12], restSeconds: 75 }),
  def({ key: "russian-twist", name: "Russian twist", aliases: ["russian twists"], pattern: "core", equipment: ["bodyweight", "dumbbell"], primary: ["obliques"], secondary: ["abs"], compound: false, range: [16, 24], restSeconds: 60, increment: 0 }),
  def({ key: "plank", name: "Plank", aliases: ["planks", "front plank"], pattern: "core", equipment: ["bodyweight"], primary: ["abs"], secondary: ["obliques"], compound: false, measure: "time", range: [30, 60], restSeconds: 60 }),
  def({ key: "side-plank", name: "Side plank", aliases: ["side planks"], pattern: "core", equipment: ["bodyweight"], primary: ["obliques"], secondary: ["abs"], compound: false, measure: "time", range: [20, 45], restSeconds: 45 }),
];

const BY_KEY = new Map(EXERCISES.map((exercise) => [exercise.key, exercise]));

/** "DB Bench-Press!" → "dumbbell bench press": the form every lookup compares. */
export function normaliseExerciseName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bdb\b/g, "dumbbell")
    .replace(/\bbb\b/g, "barbell")
    .replace(/\s+/g, " ")
    .trim();
}

const BY_NAME = new Map<string, ExerciseDef>();
for (const exercise of EXERCISES) {
  for (const name of [exercise.name, exercise.key, ...exercise.aliases]) {
    const normalised = normaliseExerciseName(name);
    if (!BY_NAME.has(normalised)) BY_NAME.set(normalised, exercise);
  }
}

export function exerciseByKey(key: string | null | undefined): ExerciseDef | null {
  return key ? (BY_KEY.get(key) ?? null) : null;
}

/** Library entry for a typed name, tolerating plurals; null if it is not one we know. */
export function matchExercise(name: string | null | undefined): ExerciseDef | null {
  if (!name) return null;
  const normalised = normaliseExerciseName(name);
  return (
    BY_NAME.get(normalised) ??
    BY_NAME.get(normalised.replace(/s$/, "")) ??
    BY_NAME.get(`${normalised}s`) ??
    null
  );
}

export interface ResolvedExercise {
  def: ExerciseDef | null;
  primary: Muscle[];
  secondary: Muscle[];
}

/**
 * Which muscles a logged exercise trained. Library key first, then the name,
 * then whatever muscle group was typed alongside it. Unknown stays unknown —
 * an exercise we cannot place earns no muscle credit rather than a wrong one.
 */
export function resolveExercise(entry: {
  exerciseKey?: string | null;
  name: string;
  muscleGroup?: string | null;
}): ResolvedExercise {
  const known = exerciseByKey(entry.exerciseKey) ?? matchExercise(entry.name);
  if (known) return { def: known, primary: known.primary, secondary: known.secondary };
  return { def: null, primary: musclesFromLegacyGroup(entry.muscleGroup), secondary: [] };
}

/** Which kinds of kit a training setup has. */
export const EQUIPMENT_SETUPS = ["gym", "dumbbells", "bodyweight"] as const;
export type EquipmentSetup = (typeof EQUIPMENT_SETUPS)[number];

export const EQUIPMENT_SETUP_LABELS: Record<EquipmentSetup, string> = {
  gym: "Full gym",
  dumbbells: "Dumbbells at home",
  bodyweight: "Bodyweight only",
};

const AVAILABLE: Record<EquipmentSetup, readonly Equipment[]> = {
  gym: ["barbell", "dumbbell", "cable", "machine", "bodyweight"],
  dumbbells: ["dumbbell", "bodyweight"],
  bodyweight: ["bodyweight"],
};

export function canDo(exercise: ExerciseDef, setup: EquipmentSetup): boolean {
  return exercise.equipment.some((kit) => AVAILABLE[setup].includes(kit));
}

/** Progress by reps, not load: no external weight to add. */
export function isBodyweight(exercise: ExerciseDef): boolean {
  return exercise.increment === 0;
}
