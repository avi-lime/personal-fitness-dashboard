"use client";

import { useState } from "react";
import { ProgressBar } from "@/components/charts/progress-bar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import BODY from "@/lib/fitness/body-paths.json";
import { STATE_STYLE } from "./muscle-chip";
import { EXERCISES, canDo, type EquipmentSetup } from "@/lib/fitness/exercises";
import { MUSCLE_META, type Muscle } from "@/lib/fitness/muscles";
import type { MuscleView } from "@/server/services/training";
import { formatShortDate } from "@/lib/date";
import { cn } from "@/lib/utils";

/*
 * Anatomical outlines from MuscleMap (MIT, via openGym; see NOTICE.md). Its
 * regions are coarser than our muscles in places — one deltoid, one upper back
 * that includes the lats — so a region shows whichever of its muscles needs the
 * most care, and tapping it selects that muscle. Hot for recovering, green for
 * ready, grey for left alone; the dashed ring marks the one case colour cannot
 * show: recovered and green, but behind on this week's sets.
 */
type Figure = keyof typeof BODY;
type View = "front" | "back";

const REGIONS: Record<View, Record<string, Muscle[]>> = {
  front: {
    chest: ["chest"],
    deltoids: ["front_delts", "side_delts"],
    biceps: ["biceps"],
    triceps: ["triceps"],
    forearm: ["forearms"],
    abs: ["abs"],
    "hip-flexors": ["abs"],
    obliques: ["obliques"],
    serratus: ["obliques"],
    quadriceps: ["quads"],
    adductors: ["quads"],
    calves: ["calves"],
    tibialis: ["calves"],
    trapezius: ["upper_back"],
  },
  back: {
    trapezius: ["upper_back"],
    deltoids: ["rear_delts", "side_delts"],
    "upper-back": ["lats", "upper_back"],
    "lower-back": ["lower_back"],
    triceps: ["triceps"],
    forearm: ["forearms"],
    gluteal: ["glutes"],
    adductors: ["glutes"],
    hamstring: ["hamstrings"],
    calves: ["calves"],
  },
};

const ringed = (status: MuscleView) => status.state === "ready" && status.underVolume;

/** The muscle a region speaks for: the one most in need, recovering ones first. */
function representative(muscles: Muscle[], byMuscle: Map<Muscle, MuscleView>): MuscleView | null {
  const statuses = muscles.map((muscle) => byMuscle.get(muscle)).filter((entry): entry is MuscleView => Boolean(entry));
  return (
    statuses.find((entry) => entry.state === "recovering") ??
    [...statuses].sort((a, b) => b.attentionScore - a.attentionScore)[0] ??
    null
  );
}

function FigureView({
  figure,
  view,
  byMuscle,
  selected,
  onSelect,
}: {
  figure: Figure;
  view: View;
  byMuscle: Map<Muscle, MuscleView>;
  selected: Muscle | null;
  onSelect: (muscle: Muscle) => void;
}) {
  const { vb, p: parts } = BODY[figure][view];
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg viewBox={vb} className="h-auto w-full max-w-[11rem]" role="group" aria-label={`${view} view`}>
        {Object.entries(parts).map(([part, shapes]) => {
          const muscles = REGIONS[view][part];
          const status = muscles ? representative(muscles, byMuscle) : null;
          if (!status) {
            return shapes.map((d, index) => <path key={`${part}-${index}`} d={d} className="fill-foreground/[0.08]" />);
          }
          const active = selected !== null && muscles.includes(selected);
          return (
            <g
              key={part}
              role="button"
              tabIndex={0}
              aria-label={`${MUSCLE_META[status.muscle].label}: ${STATE_STYLE[status.state].label}`}
              aria-pressed={active}
              onClick={() => onSelect(status.muscle)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(status.muscle);
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
                  strokeWidth={active ? 6 : 4}
                  strokeDasharray={!active && ringed(status) ? "10 8" : undefined}
                  className="transition-[fill-opacity,stroke] duration-200"
                />
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="text-xs tracking-widest text-muted-foreground uppercase">{view}</figcaption>
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
  const [figure, setFigure] = useState<Figure>("male");
  const status = selected ? byMuscle.get(selected) : null;

  const exercises = status
    ? EXERCISES.filter((exercise) => exercise.primary.includes(status.muscle) && canDo(exercise, equipment)).slice(0, 3)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ToggleGroup type="single" value={figure} onValueChange={(value) => value && setFigure(value as Figure)} aria-label="Figure">
          <ToggleGroupItem value="male" size="sm">Male</ToggleGroupItem>
          <ToggleGroupItem value="female" size="sm">Female</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FigureView figure={figure} view="front" byMuscle={byMuscle} selected={selected} onSelect={setSelected} />
        <FigureView figure={figure} view="back" byMuscle={byMuscle} selected={selected} onSelect={setSelected} />
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
