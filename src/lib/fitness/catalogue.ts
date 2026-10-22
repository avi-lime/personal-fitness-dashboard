import "server-only";
import CATALOGUE from "./catalogue.json";
import { resolveExercise, wordsOf, type ExerciseDef, type ResolvedExercise } from "./exercises";
import type { Muscle } from "./muscles";

/**
 * openGym's exercise catalogue (AGPL, see NOTICE.md), trimmed to movements
 * that build muscle: 4,000-odd names with their muscles and instructions.
 * Server-side only — it is far too big for a page bundle. Regenerate with
 * scripts/import-opengym-catalogue.mjs.
 *
 * It backs up the curated library (exercises.ts), which stays the source of
 * planner data like rep ranges and rest; this only has to answer "which
 * muscles did that exercise train, and how is it done?".
 */
export interface CatalogueEntry {
  name: string;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: string | null;
  instructions: string[];
}

type Row = [string, Muscle[], Muscle[], string | null, string[]];

// Matching is openGym's: names compared as a bag of normalised words (see wordsOf).
let index: { exact: Map<string, Row>; all: Array<{ row: Row; words: Set<string> }> } | null = null;

function build() {
  if (index) return index;
  index = { exact: new Map(), all: [] };
  for (const row of CATALOGUE as Row[]) {
    const words = wordsOf(row[0]);
    const key = [...words].sort().join(" ");
    if (!index.exact.has(key)) index.exact.set(key, row);
    index.all.push({ row, words: new Set(words) });
  }
  return index;
}

const toEntry = (row: Row): CatalogueEntry => ({
  name: row[0],
  primary: row[1],
  secondary: row[2],
  equipment: row[3],
  instructions: row[4],
});

/**
 * The catalogue exercise a name refers to, or null. An exact word-bag match
 * wins; otherwise an entry containing every word of the name with at most two
 * more — but only when exactly one is that close. Filing years of training
 * under the wrong lift is worse than leaving it unmatched.
 */
const memo = new Map<string, CatalogueEntry | null>();

export function matchCatalogue(name: string): CatalogueEntry | null {
  const cached = memo.get(name);
  if (cached !== undefined) return cached;
  const found = search(name);
  memo.set(name, found);
  return found;
}

function search(name: string): CatalogueEntry | null {
  const words = wordsOf(name);
  if (words.length === 0) return null;
  const { exact, all } = build();
  const hit = exact.get([...words].sort().join(" "));
  if (hit) return toEntry(hit);

  const query = new Set(words);
  let closest: Array<{ row: Row; words: Set<string> }> = [];
  let bestExtra = Infinity;
  for (const candidate of all) {
    if (!words.every((word) => candidate.words.has(word))) continue;
    const extra = candidate.words.size - query.size;
    if (extra > 2) continue;
    if (extra < bestExtra) {
      closest = [candidate];
      bestExtra = extra;
    } else if (extra === bestExtra) {
      closest.push(candidate);
    }
  }
  if (closest.length === 1) return toEntry(closest[0].row);
  // An unqualified name means the barbell version — what every app that
  // exports one assumes ("Zercher Squat" is the barbell zercher squat).
  const barbell = closest.filter((candidate) =>
    [...candidate.words].every((word) => query.has(word) || word === "barbell"),
  );
  return barbell.length === 1 ? toEntry(barbell[0].row) : null;
}

export interface FullyResolved extends ResolvedExercise {
  /** Stable identity for "the same exercise" across sessions. */
  identity: string;
  catalogue: CatalogueEntry | null;
}

/**
 * Library first (it carries planner data), then a muscle group the user typed
 * themselves, then the catalogue. Unknown stays unknown and earns no credit.
 */
export function resolveFully(entry: { exerciseKey?: string | null; name: string; muscleGroup?: string | null }): FullyResolved {
  const custom = `custom:${entry.name.trim().toLowerCase()}`;
  const base = resolveExercise(entry);
  if (base.def) return { ...base, identity: base.def.key, catalogue: null };
  if (base.primary.length > 0) return { ...base, identity: custom, catalogue: null };
  const hit = matchCatalogue(entry.name);
  if (hit) return { def: null, primary: hit.primary, secondary: hit.secondary, identity: `catalogue:${hit.name}`, catalogue: hit };
  return { ...base, identity: custom, catalogue: null };
}

/** How to do an exercise, from the catalogue entry its name or an alias matches. */
export function instructionsFor(def: ExerciseDef | null, name: string): string[] {
  for (const candidate of def ? [def.name, ...def.aliases] : [name]) {
    const hit = matchCatalogue(candidate);
    if (hit && hit.instructions.length > 0) return hit.instructions;
  }
  return [];
}
