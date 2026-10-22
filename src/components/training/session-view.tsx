"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Minus, Plus, SkipForward, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProgressBar } from "@/components/charts/progress-bar";
import { ConfirmButton } from "@/components/common/confirm-button";
import { useAction } from "@/components/common/use-action";
import { MuscleChip } from "./muscle-chip";
import { formatClock, useRestTimer, useWakeLock } from "./use-rest-timer";
import { afterSet, exerciseLabels, type FlowExercise } from "@/lib/fitness/superset";
import { completeSetAction, finishWorkoutAction } from "@/server/actions/training";
import { addSetAction, setSupersetAction, updateSetAction } from "@/server/actions/workouts";
import { isMuscle, type Muscle } from "@/lib/fitness/muscles";
import { formatShortDate } from "@/lib/date";
import { formatValue } from "@/lib/format";
import type { SessionExerciseMeta } from "@/server/services/training";
import type { WorkoutSetView, WorkoutView } from "@/server/services/workouts";
import { cn } from "@/lib/utils";

type Report = Awaited<ReturnType<typeof finishWorkoutAction>> extends infer R
  ? R extends { ok: true; data: infer D }
    ? D
    : never
  : never;

interface Draft {
  weight: string;
  reps: string;
  seconds: string;
}

const draftFrom = (set: WorkoutSetView): Draft => ({
  weight: set.weightKg === null ? "" : String(set.weightKg),
  reps: set.reps === null ? "" : String(set.reps),
  seconds: set.durationSeconds === null ? "" : String(set.durationSeconds),
});

const toNumber = (value: string): number | null => {
  const parsed = Number(value.replace(",", "."));
  return value.trim() === "" || !Number.isFinite(parsed) ? null : parsed;
};

function Stepper({
  value,
  onChange,
  step,
  label,
  decimals,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  step: number;
  label: string;
  decimals: boolean;
  disabled: boolean;
}) {
  const bump = (delta: number) => {
    const next = Math.max(0, (toNumber(value) ?? 0) + delta);
    onChange(String(decimals ? Math.round(next * 100) / 100 : Math.round(next)));
  };
  return (
    <div className="flex w-full items-center rounded-lg bg-surface-2 ring-1 ring-border">
      <button
        type="button"
        onClick={() => bump(-step)}
        disabled={disabled}
        aria-label={`Less ${label}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-l-lg text-muted-foreground active:bg-accent disabled:opacity-40"
      >
        <Minus className="size-4" />
      </button>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={decimals ? "decimal" : "numeric"}
        aria-label={label}
        disabled={disabled}
        placeholder="–"
        className="min-w-0 flex-1 bg-transparent text-center text-base font-medium tabular outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => bump(step)}
        disabled={disabled}
        aria-label={`More ${label}`}
        className="flex size-9 shrink-0 items-center justify-center rounded-r-lg text-muted-foreground active:bg-accent disabled:opacity-40"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

/**
 * A session, one exercise at a time. Tick a set and the rest timer starts;
 * finish an exercise and the next one comes up. Built for one thumb, between
 * sets, at the gym.
 */
export function SessionView({ workout, meta }: { workout: WorkoutView; meta: SessionExerciseMeta[] }) {
  const router = useRouter();
  const { pending, run } = useAction();
  const timer = useRestTimer(`rest:${workout.id}`);
  useWakeLock();

  const metaById = useMemo(() => new Map(meta.map((entry) => [entry.exerciseId, entry])), [meta]);
  /** The workout in the shape the superset flow reads, optionally with sets marked done. */
  const flowOf = (doneNow: (set: WorkoutSetView) => boolean = () => false): FlowExercise[] =>
    workout.exercises.map((entry) => ({
      supersetGroup: entry.supersetGroup,
      restSeconds: metaById.get(entry.id)?.restSeconds ?? 90,
      sets: entry.sets.map((set) => ({ id: set.id, phase: set.phase, completed: set.completed || doneNow(set) })),
    }));
  const labels = exerciseLabels(flowOf());
  const firstOpen = workout.exercises.findIndex((exercise) => exercise.sets.some((set) => !set.completed));
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [flash, setFlash] = useState<{ setId: string; text: string; key: number } | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const current = workout.exercises[Math.min(index, workout.exercises.length - 1)];
  // Warm-ups come first however late one was added; within a phase, the logged order.
  const exercise = current
    ? { ...current, sets: [...current.sets].sort((a, b) => Number(a.phase === "work") - Number(b.phase === "work")) }
    : current;
  const workSets = exercise ? exercise.sets.filter((set) => set.phase === "work") : [];
  const info = exercise ? metaById.get(exercise.id) : undefined;
  const timed = info?.measure === "time";

  const totals = workout.exercises.reduce(
    (sum, entry) => {
      const work = entry.sets.filter((set) => set.phase === "work");
      return { done: sum.done + work.filter((set) => set.completed).length, all: sum.all + work.length };
    },
    { done: 0, all: 0 },
  );

  const draftOf = (set: WorkoutSetView) => drafts[set.id] ?? draftFrom(set);
  const edit = (set: WorkoutSetView, patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [set.id]: { ...draftOf(set), ...patch } }));

  const complete = (set: WorkoutSetView) => {
    if (!exercise || !info) return;
    timer.unlockAudio();
    const draft = draftOf(set);
    // The session as it will be once this set is done — what the flow decides from.
    const after = flowOf((entry) => entry.id === set.id);
    run(
      () =>
        completeSetAction({
          setId: set.id,
          reps: timed ? null : toNumber(draft.reps),
          weightKg: timed ? null : toNumber(draft.weight),
          durationSeconds: timed ? toNumber(draft.seconds) : null,
        }),
      {
        onSuccess: (result) => {
          if (result.xp > 0) setFlash({ setId: set.id, text: `+${result.xp} XP`, key: Date.now() });
          if (result.pr) {
            const best =
              result.pr.kind === "time"
                ? `${result.pr.durationSeconds}s`
                : result.pr.kind === "reps"
                  ? `${result.pr.reps} reps`
                  : `${result.pr.weightKg} kg × ${result.pr.reps}`;
            // The rest timer owns the bottom of the screen during a session.
            toast.success(`New record · ${result.exerciseName}`, {
              description: best,
              icon: <Trophy className="size-4 text-brand" />,
              position: "top-center",
            });
          }
          const { restSeconds, next } = afterSet(after, index, set.id);
          if (restSeconds > 0) timer.start(restSeconds);
          // Straight on to a superset partner; a moment's pause before a new exercise.
          if (next !== index) window.setTimeout(() => setIndex(next), restSeconds === 0 ? 0 : 600);
        },
      },
    );
  };

  const undo = (set: WorkoutSetView) => run(() => updateSetAction({ setId: set.id, completed: false }));

  const addSet = (phase: "work" | "warmup" = "work") => {
    if (!exercise || !info) return;
    const last = workSets.at(-1);
    const half = workSets[0]?.weightKg ? Math.floor(workSets[0].weightKg / 2 / info.step) * info.step : null;
    run(() =>
      addSetAction(
        phase === "warmup"
          ? { exerciseId: exercise.id, reps: 10, weightKg: half, durationSeconds: null, phase }
          : {
              exerciseId: exercise.id,
              reps: last?.reps ?? null,
              weightKg: last?.weightKg ?? null,
              durationSeconds: last?.durationSeconds ?? null,
              phase,
            },
      ),
    );
  };

  /** A drop straight after a set: lighter by a fifth, same reps — openGym's default step. */
  const addDrop = (set: WorkoutSetView) => {
    if (!info) return;
    const from = set.drops.at(-1) ?? { weightKg: set.weightKg, reps: set.reps };
    const weightKg = from.weightKg ? Math.max(0, Math.round((from.weightKg * 0.8) / info.step) * info.step) : null;
    run(() => updateSetAction({ setId: set.id, drops: [...set.drops, { weightKg, reps: from.reps }] }));
  };

  const removeDrop = (set: WorkoutSetView, at: number) =>
    run(() => updateSetAction({ setId: set.id, drops: set.drops.filter((_, position) => position !== at) }));

  const finish = () =>
    run(() => finishWorkoutAction(workout.id), {
      onSuccess: (data) => {
        timer.stop();
        setReport(data);
      },
    });

  if (!exercise || !info) {
    return (
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">This session has no exercises.</p>
        <Button variant="outline" size="sm" className="mt-3 w-fit" asChild>
          <Link href={`/training/${workout.id}`}>Open the editor</Link>
        </Button>
      </Card>
    );
  }

  const open = totals.all - totals.done;
  const nextSet = exercise.sets.find((set) => !set.completed);

  return (
    <div className="space-y-4 pb-44">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/training" aria-label="Back to training">
            <ChevronLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="font-display truncate text-2xl leading-tight">{workout.name}</h1>
          <p className="text-xs text-muted-foreground tabular">
            {totals.done} / {totals.all} sets
          </p>
        </div>
        {open > 0 ? (
          <ConfirmButton
            size="sm"
            variant="outline"
            disabled={pending}
            title="Finish with sets left?"
            description={`${open} planned set${open === 1 ? " is" : "s are"} not done. Only completed sets count.`}
            confirmLabel="Finish"
            onConfirm={finish}
          >
            Finish
          </ConfirmButton>
        ) : (
          <Button size="sm" disabled={pending} onClick={finish}>
            Finish
          </Button>
        )}
      </div>
      <ProgressBar value={totals.all ? totals.done / totals.all : 0} tone="brand" label={`${totals.done} of ${totals.all} sets`} />

      <nav aria-label="Exercises" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="flex snap-x gap-2 pb-1">
          {workout.exercises.map((entry, position) => {
            const done = entry.sets.length > 0 && entry.sets.every((set) => set.completed);
            return (
              <li key={entry.id} className="snap-start">
                <button
                  type="button"
                  onClick={() => setIndex(position)}
                  aria-current={position === index ? "step" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full px-3 text-xs whitespace-nowrap ring-1 transition-colors",
                    position === index
                      ? "bg-foreground text-background ring-foreground"
                      : done
                        ? "bg-surface-3 text-muted-foreground ring-border"
                        : "bg-surface-3 ring-border",
                  )}
                >
                  {done ? <Check className="size-3 text-positive" aria-label="Done" /> : <span className="tabular">{labels[position]}</span>}
                  {entry.name}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <Card className="gap-4 p-3 sm:p-4">
        <div className="space-y-2">
          <h2 className="font-display text-3xl leading-tight">{exercise.name}</h2>
          {(() => {
            const following = workout.exercises[index + 1];
            const linked = following && exercise.supersetGroup !== null && following.supersetGroup === exercise.supersetGroup;
            const partners = workout.exercises.filter(
              (entry, position) => position !== index && exercise.supersetGroup !== null && entry.supersetGroup === exercise.supersetGroup,
            );
            return (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {partners.length > 0 ? (
                  <span>
                    Superset {labels[index].charAt(0)} with {partners.map((entry) => entry.name).join(", ")} — no rest between, one after the round.
                  </span>
                ) : null}
                {following ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(() => setSupersetAction({ exerciseId: exercise.id, linkNext: !linked }))}
                    className="h-6 rounded-full border border-dashed border-border px-2 hover:text-foreground"
                  >
                    {linked ? `Unlink ${following.name}` : `Superset with ${following.name}`}
                  </button>
                ) : null}
              </div>
            );
          })()}
          <div className="flex flex-wrap gap-1.5">
            {info.primary.filter(isMuscle).map((muscle) => (
              <MuscleChip key={muscle} muscle={muscle as Muscle} />
            ))}
          </div>
          <p className="text-sm text-muted-foreground tabular">
            {workSets.length} sets
            {info.range ? ` · ${info.range[0]}–${info.range[1]}${timed ? "s" : " reps"}` : ""} · rest {formatClock(info.restSeconds)}
          </p>
          {info.last ? (
            <p className="text-xs text-muted-foreground tabular">
              Last ({formatShortDate(info.last.date)}):{" "}
              <span className="text-foreground">
                {info.last.sets
                  .map((set) =>
                    timed
                      ? `${set.durationSeconds ?? "?"}s`
                      : set.weightKg
                        ? `${formatValue(set.weightKg)}×${set.reps ?? "?"}`
                        : `${set.reps ?? "?"}`,
                  )
                  .join(", ")}
              </span>
            </p>
          ) : null}
          {info.rule ? <p className="text-xs text-muted-foreground">{info.rule}</p> : null}
          {info.instructions.length > 0 ? (
            <details className="group text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground">
                How to do it
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                {info.instructions.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>
            </details>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-1.5 px-1 text-[11px] tracking-wide text-muted-foreground uppercase">
            <span>Set</span>
            {timed ? <span className="col-span-2 text-center">Seconds</span> : (
              <>
                <span className="text-center">kg</span>
                <span className="text-center">Reps</span>
              </>
            )}
            <span />
          </div>
          {exercise.sets.map((set) => {
            const draft = draftOf(set);
            const isNext = set.id === nextSet?.id;
            const warmup = set.phase === "warmup";
            const position = warmup ? -1 : workSets.indexOf(set);
            const name = warmup ? "warm-up set" : `set ${position + 1}`;
            return (
              <div key={set.id} className="space-y-1">
              <div
                className={cn(
                  "relative grid grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-1.5 rounded-xl p-1",
                  isNext && "bg-brand/5 ring-1 ring-brand/30",
                  set.completed && "opacity-60",
                )}
              >
                <span
                  className={cn("text-center text-sm tabular", warmup ? "text-xs font-medium text-brand" : "text-muted-foreground")}
                  title={warmup ? "Warm-up: no XP, never a record" : undefined}
                >
                  {warmup ? "W" : position + 1}
                </span>
                {timed ? (
                  <div className="col-span-2 min-w-0">
                    <Stepper value={draft.seconds} onChange={(seconds) => edit(set, { seconds })} step={5} label="seconds" decimals={false} disabled={set.completed || pending} />
                  </div>
                ) : (
                  <>
                    <div className="min-w-0">
                      <Stepper value={draft.weight} onChange={(weight) => edit(set, { weight })} step={info.step} label="kilograms" decimals disabled={set.completed || pending} />
                    </div>
                    <div className="min-w-0">
                      <Stepper value={draft.reps} onChange={(reps) => edit(set, { reps })} step={1} label="reps" decimals={false} disabled={set.completed || pending} />
                    </div>
                  </>
                )}
                <div className="relative flex justify-center">
                  <button
                    type="button"
                    onClick={() => (set.completed ? undo(set) : complete(set))}
                    disabled={pending}
                    aria-label={set.completed ? `Undo ${name}` : `Complete ${name}`}
                    aria-pressed={set.completed}
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl ring-1 transition-colors disabled:opacity-50",
                      set.completed ? "bg-positive text-background ring-positive" : "bg-surface-2 ring-border hover:bg-accent",
                    )}
                  >
                    <Check className="size-5" />
                  </button>
                  {flash?.setId === set.id ? (
                    <span
                      key={flash.key}
                      aria-hidden
                      className="pointer-events-none absolute -top-2 text-xs font-medium whitespace-nowrap text-brand animate-[xp-float_0.9s_ease-out_forwards] motion-reduce:hidden"
                    >
                      {flash.text}
                    </span>
                  ) : null}
                </div>
              </div>
              {set.phase === "work" && (set.drops.length > 0 || set.completed) && !timed ? (
                <div className="flex flex-wrap items-center gap-1.5 pl-7">
                  {set.drops.map((drop, at) => (
                    <span key={at} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pr-1 pl-2.5 text-xs tabular ring-1 ring-border">
                      ↓ {drop.weightKg ?? "–"} kg × {drop.reps ?? "–"}
                      <button
                        type="button"
                        onClick={() => removeDrop(set, at)}
                        disabled={pending}
                        aria-label={`Remove drop ${at + 1}`}
                        className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {set.completed ? (
                    <button
                      type="button"
                      onClick={() => addDrop(set)}
                      disabled={pending}
                      className="h-6 rounded-full border border-dashed border-border px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      + Drop
                    </button>
                  ) : null}
                </div>
              ) : null}
              </div>
            );
          })}
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => addSet("work")}>
              <Plus className="size-3.5" aria-hidden /> Add a set
            </Button>
            {!timed ? (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => addSet("warmup")}>
                <Plus className="size-3.5" aria-hidden /> Add a warm-up
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex justify-between">
          <Button variant="outline" size="sm" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={index >= workout.exercises.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next <ChevronRight className="size-4" aria-hidden />
          </Button>
        </div>
      </Card>

      {timer.active ? (
        <div
          className="fixed inset-x-0 bottom-0 z-30 border-t bg-surface-3/95 px-4 pt-3 backdrop-blur"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          role="timer"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs tracking-widest text-muted-foreground uppercase">
                {timer.running ? "Rest" : "Rest over"}
              </p>
              <p className={cn("font-display text-4xl leading-none tabular", !timer.running && "text-brand")}>
                {timer.running ? formatClock(timer.remainingSeconds) : "Go"}
              </p>
              {nextSet ? (
                <p className="mt-1 truncate text-xs text-muted-foreground tabular">
                  Next: {exercise.name}
                  {timed
                    ? ` · ${draftOf(nextSet).seconds || "?"}s`
                    : ` · ${draftOf(nextSet).weight ? `${draftOf(nextSet).weight} kg × ` : ""}${draftOf(nextSet).reps || "?"}`}
                </p>
              ) : null}
            </div>
            {timer.running ? (
              <>
                <Button variant="outline" size="sm" onClick={() => timer.adjust(-15)} aria-label="Fifteen seconds less">
                  −15
                </Button>
                <Button variant="outline" size="sm" onClick={() => timer.adjust(15)} aria-label="Fifteen seconds more">
                  +15
                </Button>
              </>
            ) : null}
            <Button size="sm" variant={timer.running ? "ghost" : "default"} onClick={timer.stop} aria-label={timer.running ? "Skip rest" : "Dismiss"}>
              {timer.running ? <SkipForward className="size-4" /> : "OK"}
            </Button>
          </div>
          {timer.running ? (
            <div className="mx-auto mt-2 max-w-xl">
              <ProgressBar value={1 - timer.remainingSeconds / Math.max(1, timer.total)} tone="brand" label="Rest elapsed" />
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={report !== null} onOpenChange={(next) => !next && router.push("/training")}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">Session done</DialogTitle>
            <DialogDescription>{workout.name}</DialogDescription>
          </DialogHeader>
          {report?.session ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-surface-3 p-3">
                  <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Sets</dt>
                  <dd className="font-display text-2xl tabular">{report.session.sets}</dd>
                </div>
                <div className="rounded-xl bg-surface-3 p-3">
                  <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">Volume</dt>
                  <dd className="font-display text-2xl tabular">{report.session.volumeKg.toLocaleString()}</dd>
                </div>
                <div className="rounded-xl bg-brand/10 p-3 ring-1 ring-brand/40">
                  <dt className="text-[11px] tracking-wide text-muted-foreground uppercase">XP</dt>
                  <dd className="font-display text-2xl text-brand tabular">+{report.session.xp}</dd>
                </div>
              </dl>
              {report.prs.length > 0 ? (
                <ul className="space-y-1">
                  {report.prs.map((record) => (
                    <li key={record.identity} className="flex items-center gap-2 text-sm">
                      <Trophy className="size-4 text-brand" aria-hidden />
                      <span className="flex-1">{record.exerciseName}</span>
                      <span className="tabular">
                        {record.kind === "time"
                          ? `${record.durationSeconds}s`
                          : record.kind === "reps"
                            ? `${record.reps} reps`
                            : `${record.weightKg} kg × ${record.reps}`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {report.muscles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {report.muscles.map((muscle) => (
                    <MuscleChip key={muscle} muscle={muscle} state="recovering" />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No sets were completed, so this one earns nothing.</p>
          )}
          <DialogFooter>
            <Button variant="outline" asChild>
              <Link href="/training?tab=quests">Claim missions</Link>
            </Button>
            <Button asChild>
              <Link href="/training">Done</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
