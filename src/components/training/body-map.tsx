"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/charts/progress-bar";
import { STATE_STYLE } from "./muscle-chip";
import { EXERCISES, canDo, type EquipmentSetup } from "@/lib/fitness/exercises";
import { MUSCLE_META, type Muscle } from "@/lib/fitness/muscles";
import type { MuscleView } from "@/server/services/training";
import { formatShortDate } from "@/lib/date";
import { cn } from "@/lib/utils";

/*
 * A stylised figure, front and back, 200 × 400 each. Shapes are deliberately
 * geometric — a diagram, not an anatomy plate — so the colours carry the
 * meaning: hot for recovering, green for ready, grey for left alone. Grey
 * already says "needs attention", so the dashed ring is kept for the one case
 * colour cannot show: recovered and green, but behind on this week's sets.
 */
const ringed = (status: MuscleView) => status.state === "ready" && status.underVolume;
const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}z`;
const el = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
/** The same rounded rect on both sides of the body. */
const pair = (x: number, y: number, w: number, h: number, r: number) => [rr(x, y, w, h, r), rr(200 - x - w, y, w, h, r)];
const pairEl = (cx: number, cy: number, rx: number, ry: number) => [el(cx, cy, rx, ry), el(200 - cx, cy, rx, ry)];

const SILHOUETTE = [
  el(100, 30, 18, 21),
  rr(91, 46, 18, 16, 6),
  rr(68, 64, 64, 124, 20),
  ...pair(42, 72, 20, 72, 10),
  ...pair(36, 140, 18, 58, 9),
  ...pairEl(45, 206, 8, 10),
  rr(72, 180, 56, 30, 12),
  ...pair(72, 196, 27, 92, 13),
  ...pair(75, 286, 22, 80, 10),
  ...pairEl(86, 372, 11, 6),
];

type Regions = Partial<Record<Muscle, string[]>>;

const FRONT: Regions = {
  side_delts: pairEl(52, 84, 9, 13),
  front_delts: pairEl(66, 79, 11, 11),
  chest: pair(72, 74, 27, 36, 11),
  biceps: pair(44, 98, 16, 40, 8),
  forearms: pair(37, 146, 16, 48, 8),
  abs: [
    ...[114, 132, 150].flatMap((y) => [rr(87, y, 12, 16, 4), rr(101, y, 12, 16, 4)]),
    rr(88, 168, 24, 14, 5),
  ],
  obliques: pair(74, 116, 11, 54, 5),
  quads: pair(74, 200, 24, 80, 12),
  calves: pair(77, 292, 19, 64, 9),
};

const BACK: Regions = {
  upper_back: ["M100 60L126 74L118 116L82 116L74 74Z"],
  rear_delts: pairEl(62, 80, 11, 11),
  side_delts: pairEl(51, 87, 8, 12),
  lats: ["M74 92L86 118L88 150L74 148L67 114Z", "M126 92L114 118L112 150L126 148L133 114Z"],
  lower_back: [rr(86, 150, 28, 32, 8)],
  triceps: pair(44, 96, 16, 42, 8),
  forearms: pair(37, 146, 16, 48, 8),
  glutes: pair(73, 184, 26, 34, 13),
  hamstrings: pair(74, 222, 24, 62, 11),
  calves: pair(76, 290, 21, 62, 10),
};

function Figure({
  title,
  regions,
  byMuscle,
  selected,
  onSelect,
}: {
  title: string;
  regions: Regions;
  byMuscle: Map<Muscle, MuscleView>;
  selected: Muscle | null;
  onSelect: (muscle: Muscle) => void;
}) {
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 200 400" className="h-auto w-full max-w-[11rem]" role="group" aria-label={`${title} view`}>
        {SILHOUETTE.map((d, index) => (
          <path key={index} d={d} className="fill-foreground/[0.06]" />
        ))}
        {(Object.entries(regions) as Array<[Muscle, string[]]>).map(([muscle, shapes]) => {
          const status = byMuscle.get(muscle);
          if (!status) return null;
          const active = selected === muscle;
          return (
            <g
              key={muscle}
              role="button"
              tabIndex={0}
              aria-label={`${MUSCLE_META[muscle].label}: ${STATE_STYLE[status.state].label}`}
              aria-pressed={active}
              onClick={() => onSelect(muscle)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(muscle);
                }
              }}
              className="cursor-pointer outline-none [&:focus-visible>path]:stroke-ring"
            >
              {shapes.map((d, index) => (
                <path
                  key={index}
                  d={d}
                  fill={STATE_STYLE[status.state].fill}
                  fillOpacity={status.state === "recovering" ? 0.35 + 0.65 * (1 - status.recovery) : 0.9}
                  stroke={active ? "var(--foreground)" : ringed(status) ? "var(--brand)" : "transparent"}
                  strokeWidth={active ? 2 : 1.5}
                  strokeDasharray={!active && ringed(status) ? "3 2.5" : undefined}
                  className="transition-[fill-opacity,stroke] duration-200"
                />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs tracking-widest text-muted-foreground uppercase">{title}</figcaption>
    </figure>
  );
}

function describe(status: MuscleView): string {
  if (status.state === "recovering") {
    const hours = status.readyAt ? Math.max(1, Math.round((new Date(status.readyAt).getTime() - Date.now()) / 3_600_000)) : 0;
    return `${Math.round(status.recovery * 100)}% recovered — ready in about ${hours} h.`;
  }
  if (status.lastTrained === null) return "No training on record yet.";
  const when = status.daysSince === 0 ? "today" : status.daysSince === 1 ? "yesterday" : `${status.daysSince} days ago`;
  return `Last trained ${when} (${formatShortDate(status.lastTrained)}).`;
}

export function BodyMap({ muscles, equipment }: { muscles: MuscleView[]; equipment: EquipmentSetup }) {
  const byMuscle = new Map(muscles.map((muscle) => [muscle.muscle, muscle]));
  const initial = muscles.filter((muscle) => muscle.needsAttention).sort((a, b) => b.attentionScore - a.attentionScore)[0];
  const [selected, setSelected] = useState<Muscle | null>(initial?.muscle ?? null);
  const status = selected ? byMuscle.get(selected) : null;

  const exercises = status
    ? EXERCISES.filter((exercise) => exercise.primary.includes(status.muscle) && canDo(exercise, equipment)).slice(0, 3)
    : [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Figure title="Front" regions={FRONT} byMuscle={byMuscle} selected={selected} onSelect={setSelected} />
        <Figure title="Back" regions={BACK} byMuscle={byMuscle} selected={selected} onSelect={setSelected} />
      </div>

      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        {(["recovering", "ready", "due", "neglected"] as const).map((state) => (
          <li key={state} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", STATE_STYLE[state].dot)} aria-hidden />
            {STATE_STYLE[state].label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-dashed border-brand" aria-hidden />
          Behind this week
        </li>
      </ul>

      {status ? (
        <div className="space-y-3 rounded-xl bg-surface-3 p-4" aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-2xl">{MUSCLE_META[status.muscle].label}</h3>
            <span className="text-sm tabular">
              Lv <span className="text-brand">{status.level.level}</span>
            </span>
          </div>
          <p className="text-sm">
            <span className={cn("mr-2 inline-block size-2 rounded-full", STATE_STYLE[status.state].dot)} aria-hidden />
            {STATE_STYLE[status.state].label}. <span className="text-muted-foreground">{describe(status)}</span>
          </p>
          {status.state === "recovering" ? (
            <ProgressBar value={status.recovery} tone="brand" label="Recovery" />
          ) : null}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>This week</span>
              <span className="tabular">
                {status.weeklySets} / {status.weeklyTarget} sets
              </span>
            </div>
            <ProgressBar
              value={status.weeklySets / status.weeklyTarget}
              tone={status.weeklySets >= status.weeklyTarget ? "positive" : "neutral"}
              label={`${status.weeklySets} of ${status.weeklyTarget} weekly sets`}
            />
          </div>
          {exercises.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Trains it: <span className="text-foreground">{exercises.map((exercise) => exercise.name).join(" · ")}</span>
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-center text-sm text-muted-foreground">Tap a muscle for details.</p>
      )}
    </div>
  );
}
