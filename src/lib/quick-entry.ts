import type { MealType } from "./domain";

/**
 * Parser for the Ctrl+K quick-entry bar. Input is short, typed at speed and
 * never trusted: every branch produces a narrow, validated intent or nothing.
 */
export type QuickEntryIntent =
  | { kind: "water"; milliliters: number }
  | { kind: "food"; name: string; calories: number; protein: number | null; mealType: MealType | null }
  | { kind: "protein"; grams: number }
  | { kind: "weight"; kilograms: number }
  | { kind: "sleep"; hours: number }
  | { kind: "workout"; name: string }
  | { kind: "note"; text: string };

const MEAL_WORDS: Record<string, MealType> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snack: "snack",
};

function num(value: string): number {
  return Number.parseFloat(value.replace(",", "."));
}

function findMeal(input: string): MealType | null {
  for (const [word, meal] of Object.entries(MEAL_WORDS)) {
    if (new RegExp(`\\b${word}\\b`, "i").test(input)) return meal;
  }
  return null;
}

/** Returns a structured intent, or `null` when the text is not recognised. */
export function parseQuickEntry(raw: string): QuickEntryIntent | null {
  const input = raw.trim();
  if (!input) return null;
  const lower = input.toLowerCase();

  // note: "note ..." / "n: ..."
  const note = lower.match(/^(?:note|n)[:\s]+(.+)$/);
  if (note) {
    const text = input.slice(input.length - note[1].length).trim();
    return text ? { kind: "note", text } : null;
  }

  // workout: "workout complete", "workout done", "log workout push day"
  const workout = lower.match(/^(?:log\s+)?workout\b\s*(.*)$/);
  if (workout) {
    const rest = workout[1].replace(/^(complete|completed|done|finished)$/i, "").trim();
    return { kind: "workout", name: rest ? input.slice(input.length - rest.length).trim() : "Workout" };
  }

  // weight: "weigh 50.4", "weight 50.4 kg", "50.4 kg"
  const weight =
    lower.match(/^(?:weigh|weight|bw)\s*(-?\d+(?:[.,]\d+)?)\s*(?:kg|kgs)?$/) ??
    lower.match(/^(-?\d+(?:[.,]\d+)?)\s*kgs?$/);
  if (weight) {
    const kilograms = num(weight[1]);
    return Number.isFinite(kilograms) && kilograms > 0 && kilograms < 500
      ? { kind: "weight", kilograms }
      : null;
  }

  // sleep: "slept 7.5h", "sleep 7h30", "sleep 450m"
  const sleep = lower.match(/^(?:slept|sleep)\s*(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|hours|m|min|mins)?$/);
  if (sleep) {
    const value = num(sleep[1]);
    const unit = sleep[2] ?? "h";
    const hours = unit.startsWith("m") ? value / 60 : value;
    return Number.isFinite(hours) && hours > 0 && hours <= 24 ? { kind: "sleep", hours } : null;
  }

  // water: "+500 ml water", "water 500", "500ml", "+0.5 l water"
  const water =
    lower.match(/^[+]?\s*(\d+(?:[.,]\d+)?)\s*(ml|l|litre|litres|liter|liters)\b.*$/) ??
    lower.match(/^water\s*[+]?\s*(\d+(?:[.,]\d+)?)\s*(ml|l)?$/);
  if (water && (/(water|ml|\bl\b|litre|liter)/.test(lower))) {
    const value = num(water[1]);
    const unit = water[2] ?? "ml";
    const milliliters = Math.round(unit.startsWith("l") ? value * 1000 : value);
    return Number.isFinite(milliliters) && milliliters > 0 && milliliters <= 10_000
      ? { kind: "water", milliliters }
      : null;
  }

  // protein: "+25 g protein", "protein 25"
  const protein =
    lower.match(/^[+]?\s*(\d+(?:[.,]\d+)?)\s*g?\s*(?:of\s+)?protein$/) ??
    lower.match(/^protein\s*[+]?\s*(\d+(?:[.,]\d+)?)\s*g?$/);
  if (protein) {
    const grams = num(protein[1]);
    return Number.isFinite(grams) && grams > 0 && grams <= 500 ? { kind: "protein", grams } : null;
  }

  // calories: "log 450 kcal lunch", "+450 kcal", "450 kcal oats"
  const calories = lower.match(/^(?:log\s+|add\s+|[+])?\s*(\d+(?:[.,]\d+)?)\s*(?:kcal|cal|calories)\b(.*)$/);
  if (calories) {
    const value = num(calories[1]);
    if (!Number.isFinite(value) || value <= 0 || value > 20_000) return null;
    const mealType = findMeal(lower);
    const trailing = calories[2].trim();
    const label = trailing
      ? input.slice(input.length - trailing.length).trim()
      : mealType
        ? mealType[0].toUpperCase() + mealType.slice(1)
        : "Quick entry";
    return {
      kind: "food",
      name: label.replace(/\s+/g, " ").trim() || "Quick entry",
      calories: value,
      protein: null,
      mealType,
    };
  }

  return null;
}

/** Human-readable preview of what the entry will do, for the palette. */
export function describeIntent(intent: QuickEntryIntent): string {
  switch (intent.kind) {
    case "water":
      return `Log ${intent.milliliters} ml of water`;
    case "protein":
      return `Log ${intent.grams} g protein`;
    case "food":
      return `Log ${intent.calories} kcal — ${intent.name}${intent.mealType ? ` (${intent.mealType})` : ""}`;
    case "weight":
      return `Record weight ${intent.kilograms} kg`;
    case "sleep":
      return `Log ${intent.hours} h of sleep`;
    case "workout":
      return `Log workout "${intent.name}"`;
    case "note":
      return `Add note "${intent.text}"`;
  }
}

export const QUICK_ENTRY_EXAMPLES = [
  "+500 ml water",
  "+25 g protein",
  "log 450 kcal lunch",
  "weigh 50.4 kg",
  "slept 7.5h",
  "workout complete",
  "note felt strong today",
];
