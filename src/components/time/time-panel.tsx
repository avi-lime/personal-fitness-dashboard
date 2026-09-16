"use client";

import { useEffect, useState } from "react";
import { Play, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Stat } from "@/components/common/stat";
import { Field } from "@/components/common/field";
import { EmptyState } from "@/components/common/empty-state";
import { Sparkline } from "@/components/charts/sparkline";
import { AreaSelect } from "@/components/common/area-select";
import { useAction } from "@/components/common/use-action";
import {
  deleteTimeEntryAction,
  logTimeAction,
  startTimerAction,
  stopTimerAction,
} from "@/server/actions/time";
import { AREA_LABELS, type AreaKey } from "@/lib/domain";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface TimeEntryView {
  id: string;
  category: AreaKey;
  label: string | null;
  start: string;
  end: string | null;
  minutes: number | null;
}

export interface RunningTimerView {
  id: string;
  category: AreaKey;
  label: string | null;
  startedAtIso: string;
}

function useElapsedMinutes(startedAtIso: string | null): number {
  const compute = () => (startedAtIso ? Math.max(0, (Date.now() - Date.parse(startedAtIso)) / 60_000) : 0);
  const [elapsed, setElapsed] = useState(compute);
  useEffect(() => {
    if (!startedAtIso) return;
    const interval = setInterval(() => setElapsed(compute()), 10_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAtIso]);
  return elapsed;
}

export function TimePanel({
  running,
  entries,
  totalsToday,
  weekMinutes,
}: {
  running: RunningTimerView | null;
  entries: TimeEntryView[];
  totalsToday: Record<string, number>;
  weekMinutes: number[];
}) {
  const [category, setCategory] = useState<AreaKey | null>("study");
  const [label, setLabel] = useState("");
  const [logCategory, setLogCategory] = useState<AreaKey | null>("study");
  const [logMinutes, setLogMinutes] = useState("");
  const { pending, run } = useAction();
  const elapsed = useElapsedMinutes(running?.startedAtIso ?? null);
  const totalToday = Object.values(totalsToday).reduce((sum, minutes) => sum + minutes, 0) + elapsed;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Time</h1>
        <p className="text-sm text-muted-foreground">
          Sessions by area. Finished sessions feed &ldquo;time tracked&rdquo; goals.
        </p>
      </div>

      <Card
        className={cn(
          "gap-4 p-5",
          running && "bg-surface-3 ring-1 ring-brand/40",
        )}
      >
        {running ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-brand uppercase">
                <span className="size-1.5 animate-pulse rounded-full bg-brand" aria-hidden />
                Running · {AREA_LABELS[running.category]}
              </p>
              <p className="font-display mt-1 text-5xl">{formatDuration(elapsed / 60)}</p>
              {running.label ? <p className="text-sm text-muted-foreground">{running.label}</p> : null}
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                run(() => stopTimerAction(), { success: "Timer stopped" })
              }
            >
              <Square className="size-4" aria-hidden /> Stop
            </Button>
          </div>
        ) : (
          <form
            className="grid grid-cols-2 items-end gap-3 md:grid-cols-[11rem_minmax(0,1fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              if (!category) return;
              run(() => startTimerAction({ category, label: label.trim() || null }), {
                success: `${AREA_LABELS[category]} timer started`,
                onSuccess: () => setLabel(""),
              });
            }}
          >
            <Field id="timer-category" label="Category">
              <AreaSelect id="timer-category" value={category} onChange={setCategory} />
            </Field>
            <Field id="timer-label" label="What" className="col-span-2 md:col-span-1">
              <Input
                id="timer-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="optional, e.g. system design prep"
              />
            </Field>
            <Button type="submit" size="sm" disabled={pending || !category}>
              <Play className="size-4" aria-hidden /> Start
            </Button>
          </form>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="gap-3 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">Today</h2>
              <p className="tabular text-sm text-muted-foreground">{formatDuration(totalToday / 60)} total</p>
            </div>
            {entries.length === 0 && !running ? (
              <EmptyState title="Nothing tracked today" description="Start a timer or log a finished session." />
            ) : (
              <ul className="divide-y">
                {entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 py-2">
                    <span className="tabular w-24 text-xs text-muted-foreground">
                      {entry.start}
                      {entry.end ? ` – ${entry.end}` : ""}
                    </span>
                    <span className="min-w-0 flex-1 text-sm">
                      {AREA_LABELS[entry.category]}
                      {entry.label ? <span className="text-muted-foreground"> · {entry.label}</span> : null}
                    </span>
                    <span className="tabular text-sm font-medium">
                      {entry.minutes === null ? "running" : formatDuration(entry.minutes / 60)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending}
                      aria-label="Delete session"
                      onClick={() => run(() => deleteTimeEntryAction(entry.id), { success: "Session deleted" })}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="gap-3 p-4">
            <h2 className="text-sm font-medium">Log a finished session</h2>
            <form
              className="grid grid-cols-2 items-end gap-3 md:grid-cols-[11rem_7rem_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                const minutes = Number.parseInt(logMinutes, 10);
                if (!logCategory || !Number.isFinite(minutes)) return;
                run(() => logTimeAction({ category: logCategory, minutes }), {
                  success: "Session logged",
                  onSuccess: () => setLogMinutes(""),
                });
              }}
            >
              <Field id="log-category" label="Category">
                <AreaSelect id="log-category" value={logCategory} onChange={setLogCategory} />
              </Field>
              <Field id="log-minutes" label="Minutes">
                <Input
                  id="log-minutes"
                  inputMode="numeric"
                  value={logMinutes}
                  onChange={(event) => setLogMinutes(event.target.value)}
                  placeholder="45"
                />
              </Field>
              <Button type="submit" size="sm" disabled={pending || !logMinutes}>
                Log
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="gap-3 p-4">
            <h2 className="text-sm font-medium">By area today</h2>
            {Object.keys(totalsToday).length === 0 ? (
              <p className="text-sm text-muted-foreground">No finished sessions yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(totalsToday)
                  .sort(([, a], [, b]) => b - a)
                  .map(([key, minutes]) => (
                    <Stat key={key} label={AREA_LABELS[key as AreaKey] ?? key} value={formatDuration(minutes / 60)} />
                  ))}
              </div>
            )}
          </Card>
          <Card className="gap-2 p-4">
            <h2 className="text-sm font-medium">Last 7 days</h2>
            {weekMinutes.some((minutes) => minutes > 0) ? (
              <>
                <Sparkline values={weekMinutes} ariaLabel="Minutes tracked per day, last 7 days" height={40} />
                <p className="tabular text-xs text-muted-foreground">
                  {formatDuration(weekMinutes.reduce((sum, minutes) => sum + minutes, 0) / 60)} this week
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
