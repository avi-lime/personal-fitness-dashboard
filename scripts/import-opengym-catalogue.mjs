// Converts openGym's exercise catalogue (AGPL, see NOTICE.md) into the compact
// server-side table at src/lib/fitness/catalogue.json:
//   [name, primary muscles, secondary muscles, equipment, instructions]
// Only movements that build muscle are kept: a logged stretch must not count
// as training the muscle it stretches. openGym's media is never read.
//
// Usage: node scripts/import-opengym-catalogue.mjs ../openGym/catalogue/exercises
import fs from "node:fs";
import path from "node:path";

const dir = process.argv[2];
if (!dir) throw new Error("Pass the path to openGym/catalogue/exercises");

const KEEP = new Set(["strength", "calisthenics", "olympic", "isometric", "plyometrics"]);

// openGym's "delts" is one muscle; ours is three heads. The name says which.
function delt(name) {
  if (/\b(rear|reverse fly|face pull|bent over (lateral|raise)|rear delt)\b/.test(name)) return "rear_delts";
  if (/\b(lateral|side raise|upright row)\b/.test(name)) return "side_delts";
  return "front_delts";
}

const TARGET = {
  abs: "abs", pectorals: "chest", biceps: "biceps", glutes: "glutes", triceps: "triceps",
  "upper back": "upper_back", lats: "lats", calves: "calves", quads: "quads", forearms: "forearms",
  hamstrings: "hamstrings", spine: "lower_back", traps: "upper_back", abductors: "glutes",
  "levator scapulae": "upper_back",
  // adductors, serratus anterior, cardiovascular system: no muscle of ours.
};

const SECONDARY = {
  shoulders: "front_delts", deltoids: "front_delts", "rear deltoids": "rear_delts", "rotator cuff": "rear_delts",
  chest: "chest", "upper chest": "chest", triceps: "triceps", biceps: "biceps", brachialis: "biceps",
  forearms: "forearms", wrists: "forearms", "wrist flexors": "forearms", "wrist extensors": "forearms",
  "grip muscles": "forearms", back: "upper_back", "upper back": "upper_back", rhomboids: "upper_back",
  trapezius: "upper_back", traps: "upper_back", lats: "lats", "latissimus dorsi": "lats",
  "lower back": "lower_back", core: "abs", abdominals: "abs", "lower abs": "abs", obliques: "obliques",
  glutes: "glutes", quadriceps: "quads", hamstrings: "hamstrings", calves: "calves", soleus: "calves",
};

const rows = [];
for (const file of fs.readdirSync(dir).sort()) {
  const entry = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  if (!entry.name || !KEEP.has(entry.category)) continue;
  const name = entry.name.toLowerCase();
  const target = entry.target === "delts" ? delt(name) : TARGET[entry.target];
  if (!target) continue;
  const secondary = [...new Set((entry.secondaryMuscles ?? []).map((m) => (m === "shoulders" || m === "deltoids" ? delt(name) : SECONDARY[m])))]
    .filter((m) => m && m !== target);
  rows.push([name, [target], secondary, entry.equipment ?? null, entry.instructions ?? []]);
}

const out = path.resolve("src/lib/fitness/catalogue.json");
fs.writeFileSync(out, JSON.stringify(rows));
console.log(`${rows.length} exercises → ${path.relative(process.cwd(), out)} (${Math.round(fs.statSync(out).size / 1024)} KB)`);
