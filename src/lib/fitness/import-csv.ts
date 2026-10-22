import { matchExercise } from "./exercises";
import type { LocalDate } from "@/lib/date";

/**
 * Workout history from another app's CSV export — ported from openGym's
 * importer (AGPL, see NOTICE.md), which is verified against real exports:
 *
 *   FitNotes (Android) Date,Exercise,Category,Weight,Weight Unit,Reps,Distance,Distance Unit,Time,Comment
 *   FitNotes 2 (iOS)   Date,Exercise,Category,Weight (kg),Weight (lbs),Reps,Distance,Distance Unit,Time,Notes,Kind
 *   Strong             Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE
 *   Hevy               title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe
 *
 * Every app exports one row per set, so the header is read into a column map
 * rather than fixed positions. Strength work only: rows that are pure cardio
 * (a distance and no reps) are counted and skipped, since this app does not
 * track cardio. Weights end up in kilograms.
 */

/** A real CSV reader: quoted fields, embedded commas and newlines, doubled quotes, BOM, CRLF. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  const separator = delimiterOf(s);
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === separator) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((cell) => cell !== "")) rows.push(row);
  return rows;
}

// Strong's newer export, and any spreadsheet saved in a comma-decimal locale, separates with
// ';'. The header holds no numbers, so a ';' there is a separator.
function delimiterOf(s: string): string {
  const newline = s.search(/[\r\n]/);
  const head = (newline < 0 ? s : s.slice(0, newline)).replace(/"[^"]*"/g, "");
  return head.split(";").length > head.split(",").length ? ";" : ",";
}

// '#' reads as "no": Strong's "Workout #" is the session number, not its name.
const norm = (header: string) =>
  header.toLowerCase().replace(/#/g, " no ").replace(/[^a-z0-9]+/g, " ").trim();

const COLUMNS: Array<[string, string[]]> = [
  ["exercise", ["exercise", "exercise name", "exercise title"]],
  ["date", ["date", "workout date"]],
  ["startTime", ["start time", "start date"]],
  ["endTime", ["end time"]],
  ["workoutName", ["workout name", "title", "workout"]],
  ["weightKg", ["weight kg"]],
  ["weightLb", ["weight lbs", "weight lb"]],
  ["weight", ["weight"]],
  ["weightUnit", ["weight unit", "unit"]],
  ["reps", ["reps", "repetitions"]],
  ["rpe", ["rpe", "rpe rating"]],
  ["distanceKm", ["distance km"]],
  ["distance", ["distance"]],
  ["seconds", ["seconds", "duration seconds", "set duration sec"]],
  ["time", ["time", "duration"]],
  ["durationSec", ["duration sec", "duration secs"]],
  ["setType", ["set type"]],
  ["superset", ["superset id"]],
  ["workoutNote", ["workout notes", "workout note", "description"]],
];

function mapHeader(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((cell, index) => {
    const name = norm(cell);
    for (const [field, names] of COLUMNS) {
      if (map[field] === undefined && names.includes(name)) {
        map[field] = index;
        return;
      }
    }
  });
  return map;
}

/** Which app a header looks like, shown back so the user can sanity-check. */
export function detectSource(header: string[]): string | null {
  const h = header.map(norm);
  if (h.includes("exercise title") && h.includes("set index")) return "Hevy";
  if (h.includes("exercise name") && h.includes("set order")) return "Strong";
  if (h.includes("exercise") && h.includes("kind")) return "FitNotes (iOS)";
  if (h.includes("exercise") && (h.includes("weight unit") || h.includes("category"))) return "FitNotes";
  return null;
}

// --- Dates ------------------------------------------------------------------

// Hevy and Strong localise the month on every row, so an English-only table drops most of a
// French history. Keys are lower-case and stripped of accents.
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  janv: 1, fevr: 2, mars: 3, avri: 4, avr: 4, mai: 5, juin: 6, juil: 7, aout: 8, sept: 9, octo: 10, nove: 11, dece: 12,
  ene: 1, fev: 2, abr: 4, ago: 8, set: 9, out: 10, dic: 12,
  mrz: 3, mei: 5, okt: 10, dez: 12, maart: 3, mrt: 3,
  gen: 1, mag: 5, giu: 6, lug: 7, ott: 10,
};

function monthOf(word: string): number | null {
  const key = word.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return MONTHS[key] ?? MONTHS[key.slice(0, 4)] ?? MONTHS[key.slice(0, 3)] ?? null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** A real calendar day, not before 1900 and not in the future; else null. */
function calendarDay(y: number, mo: number, d: number, h?: string, mi?: string): { date: LocalDate; ms: number | null } | null {
  const at = new Date(Date.UTC(y, mo - 1, d));
  if (y < 1900 || at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d) return null;
  if (h !== undefined && (Number(h) > 23 || Number(mi) > 59)) return null;
  const now = new Date();
  if (at.getTime() > Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1)) return null;
  const ms = h === undefined ? null : (Number(h) * 60 + Number(mi ?? 0)) * 60_000;
  return { date: `${y}-${pad(mo)}-${pad(d)}`, ms };
}

/**
 * "2020-12-30 18:51:52" · "2024/03/07" · "22 Dec 2025, 08:00" · "21 août 2024, 18:00" ·
 * "Mar 3, 2025" · "07/03/2024" → the calendar day and the time since midnight, if any.
 */
export function parseWhen(value: string): { date: LocalDate; ms: number | null } | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T ](\d{1,2}):(\d{2}))?/);
  if (m) return calendarDay(+m[1], +m[2], +m[3], m[4], m[5]);
  m = v.match(/^(\d{1,2})\s+(\p{L}{3,})\.?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/u);
  let month = m ? monthOf(m[2]) : null;
  if (m && month) return calendarDay(+m[3], month, +m[1], m[4], m[5]);
  m = v.match(/^(\p{L}{3,})\.?\s+(\d{1,2}),?\s+(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/u);
  month = m ? monthOf(m[1]) : null;
  if (m && month) return calendarDay(+m[3], month, +m[2], m[4], m[5]);
  // Day first when ambiguous: the apps write unambiguous dates, so a bare numeric one came
  // through a spreadsheet, and those are usually European.
  m = v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[, ]+(\d{1,2}):(\d{2}))?/);
  if (m) {
    const [a, b] = [+m[1], +m[2]];
    const day = a > 12 ? a : b > 12 ? b : a;
    const mon = day === a ? b : a;
    return calendarDay(+m[3], mon, day, m[4], m[5]);
  }
  return null;
}

/** "HH:MM:SS" · "MM:SS" · "2h 38m" · "90" (minutes) → minutes. */
function toMinutes(value: string): number {
  const s = value.trim();
  if (!s) return 0;
  if (s.includes(":")) {
    const parts = s.split(":").map((part) => Number.parseInt(part, 10) || 0);
    const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    return seconds / 60;
  }
  const hours = s.match(/(\d+)\s*h/i);
  const minutes = s.match(/(\d+)\s*m/i);
  if (hours || minutes) return (hours ? +hours[1] * 60 : 0) + (minutes ? +minutes[1] : 0);
  return num(s);
}

const num = (value: string) => {
  const n = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// --- Rows into workouts -----------------------------------------------------

const LB_TO_KG = 0.45359237;
// Past these a cell is broken, not a record.
const MAX_KG = 2000;
const MAX_REPS = 1000;

export interface ImportedSet {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  rpe: number | null;
  phase: "work" | "warmup";
  drops: Array<{ weightKg: number | null; reps: number | null }>;
}

export interface ImportedExercise {
  name: string;
  exerciseKey: string | null;
  supersetGroup: number | null;
  sets: ImportedSet[];
}

export interface ImportedWorkout {
  date: LocalDate;
  /** Wall-clock times since that day's midnight, when the file has them. */
  startMs: number | null;
  endMs: number | null;
  name: string;
  notes: string | null;
  exercises: ImportedExercise[];
}

export type ParsedImport =
  | {
      ok: true;
      source: string | null;
      workouts: ImportedWorkout[];
      sets: number;
      warmups: number;
      skipped: number;
      cardioSkipped: number;
      convertedFromLb: boolean;
      names: string[];
    }
  | { ok: false; error: "empty" | "unrecognised" };

/**
 * @param unit the profile's unit, assumed for a file that never says which it uses.
 */
export function parseWorkoutCSV(text: string, unit: "kg" | "lb" = "kg"): ParsedImport {
  const rows = parseCSV(text);
  if (rows.length < 2) return { ok: false, error: "empty" };
  const map = mapHeader(rows[0]);
  const source = detectSource(rows[0]);
  const dateField = map.date !== undefined ? "date" : map.startTime !== undefined ? "startTime" : null;
  if (!dateField || map.exercise === undefined) return { ok: false, error: "unrecognised" };

  // Strong's Duration is how long the whole workout took, written on every row; a set's own
  // time is its Seconds column. Read as a set time it turns weightless rows into an hour.
  let workoutDuration: number | undefined;
  let workoutDurationSec: number | undefined;
  if (source === "Strong" && map.time !== undefined) {
    workoutDuration = map.time;
    delete map.time;
  }
  if (map.durationSec !== undefined) {
    if (source === "Strong") workoutDurationSec = map.durationSec;
    else if (map.seconds === undefined) map.seconds = map.durationSec;
    delete map.durationSec;
  }

  const cell = (row: string[], field: string) => (map[field] === undefined ? "" : String(row[map[field]] ?? "").trim());
  const sessions = new Map<string, ImportedWorkout & { byExercise: Map<string, ImportedExercise>; groups: Map<string, number> }>();
  const names = new Set<string>();
  let sets = 0;
  let warmups = 0;
  let skipped = 0;
  let cardioSkipped = 0;
  let convertedFromLb = false;

  for (const row of rows.slice(1)) {
    const name = cell(row, "exercise");
    const when = parseWhen(cell(row, dateField));
    if (!name || !when) {
      skipped += 1;
      continue;
    }

    // Explicit kg/lb columns beat a generic column plus a unit column.
    let weight = 0;
    let rowUnit = "";
    if (cell(row, "weightKg")) {
      weight = num(cell(row, "weightKg"));
      rowUnit = "kg";
    } else if (cell(row, "weightLb")) {
      weight = num(cell(row, "weightLb"));
      rowUnit = "lb";
    } else {
      weight = num(cell(row, "weight"));
      const declared = cell(row, "weightUnit").toLowerCase();
      rowUnit = declared.startsWith("lb") ? "lb" : declared.startsWith("kg") ? "kg" : "";
    }
    const inLb = (rowUnit || unit) === "lb";
    const reps = Math.round(num(cell(row, "reps")));
    const seconds = num(cell(row, "seconds")) || toMinutes(cell(row, "time")) * 60;
    const km = num(cell(row, "distanceKm")) || num(cell(row, "distance"));

    if (!weight && !reps && !seconds && !km) {
      skipped += 1;
      continue;
    }
    if (km > 0 && !reps) {
      cardioSkipped += 1;
      continue;
    }
    if (weight < 0 || reps < 0 || seconds < 0 || weight > (inLb ? MAX_KG / LB_TO_KG : MAX_KG) || reps > MAX_REPS) {
      skipped += 1;
      continue;
    }
    if (inLb && weight) convertedFromLb = true;
    const weightKg = weight ? Math.round((inLb ? weight * LB_TO_KG : weight) * 10) / 10 : null;

    // Strong and Hevy stamp the workout's start on every row, so two sessions on one day stay
    // two workouts. FitNotes has no times: everything on a day is one session.
    const key = (source === "Strong" || source === "Hevy") && when.ms !== null
      ? `${when.date}|${when.ms}|${cell(row, "workoutName")}`
      : when.date;
    let session = sessions.get(key);
    if (!session) {
      session = {
        date: when.date,
        startMs: when.ms,
        endMs: null,
        name: cell(row, "workoutName") || "Imported workout",
        notes: cell(row, "workoutNote") || null,
        exercises: [],
        byExercise: new Map(),
        groups: new Map(),
      };
      sessions.set(key, session);
    }
    if (session.endMs === null) {
      const end = cell(row, "endTime") ? parseWhen(cell(row, "endTime")) : null;
      if (end?.ms != null && when.ms !== null) {
        const days = Math.round((Date.parse(end.date) - Date.parse(when.date)) / 86_400_000);
        session.endMs = end.ms + days * 86_400_000;
      } else if (session.startMs !== null) {
        const minutes = workoutDurationSec !== undefined
          ? num(String(row[workoutDurationSec] ?? "")) / 60
          : workoutDuration !== undefined ? toMinutes(String(row[workoutDuration] ?? "")) : 0;
        if (minutes > 0) session.endMs = session.startMs + Math.round(minutes * 60_000);
      }
    }

    const library = matchExercise(name);
    const exerciseId = library?.key ?? name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    let exercise = session.byExercise.get(exerciseId);
    if (!exercise) {
      exercise = { name: library?.name ?? name, exerciseKey: library?.key ?? null, supersetGroup: null, sets: [] };
      session.byExercise.set(exerciseId, exercise);
      session.exercises.push(exercise);
      names.add(name);
    }
    const superset = cell(row, "superset");
    if (superset && exercise.supersetGroup === null) {
      if (!session.groups.has(superset)) session.groups.set(superset, session.groups.size + 1);
      exercise.supersetGroup = session.groups.get(superset)!;
    }

    const type = cell(row, "setType").toLowerCase();
    const rpe = num(cell(row, "rpe"));
    // A drop rides inside the work set it follows; with nothing to follow it is a set of its own.
    const previous = exercise.sets.at(-1);
    if (/drop/.test(type) && previous && previous.phase === "work") {
      previous.drops.push({ weightKg, reps: reps || null });
      sets += 1;
      continue;
    }
    const warmup = /warm/.test(type);
    if (warmup) warmups += 1;
    const timed = seconds > 0 && !reps;
    exercise.sets.push({
      reps: timed ? null : reps || null,
      weightKg,
      durationSeconds: timed ? Math.round(seconds) : null,
      rpe: rpe >= 1 && rpe <= 10 ? rpe : null,
      phase: warmup ? "warmup" : "work",
      drops: [],
    });
    sets += 1;
  }

  const workouts = [...sessions.values()]
    .sort((a, b) => (a.date === b.date ? (a.startMs ?? 0) - (b.startMs ?? 0) : a.date < b.date ? -1 : 1))
    .map((session): ImportedWorkout => {
      // A superset is neighbours sharing a group; one without such a neighbour is not one.
      session.exercises.forEach((exercise, index, all) => {
        const group = exercise.supersetGroup;
        if (group !== null && all[index - 1]?.supersetGroup !== group && all[index + 1]?.supersetGroup !== group) {
          exercise.supersetGroup = null;
        }
      });
      return {
        date: session.date,
        startMs: session.startMs,
        endMs: session.endMs,
        name: session.name,
        notes: session.notes,
        exercises: session.exercises,
      };
    });

  return { ok: true, source, workouts, sets, warmups, skipped, cardioSkipped, convertedFromLb, names: [...names] };
}
