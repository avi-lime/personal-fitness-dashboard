"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Sparkline } from "@/components/charts/sparkline";
import { ProgressBar } from "@/components/charts/progress-bar";
import { toLocalTime } from "@/lib/date";
import { formatDuration, formatMoney, formatSigned, formatValue } from "@/lib/format";
import type { MonitorPayload } from "@/server/services/monitor";
import { cn } from "@/lib/utils";

const REFRESH_MS = 60_000;

/**
 * Second-monitor view: large type, no navigation, quiet refresh once a minute.
 * Data is polled rather than re-rendered by the router so nothing flashes.
 */
export function MonitorView({ initial }: { initial: MonitorPayload }) {
  const [data, setData] = useState(initial);
  const [time, setTime] = useState(() => toLocalTime(new Date(), initial.timezone));
  const [fullscreen, setFullscreen] = useState(false);
  const [stale, setStale] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tick = () => setTime(toLocalTime(new Date(), data.timezone));
    tick();
    const interval = setInterval(tick, 5_000);
    return () => clearInterval(interval);
  }, [data.timezone]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/monitor", { cache: "no-store" });
      if (!response.ok) throw new Error(String(response.status));
      setData((await response.json()) as MonitorPayload);
      setStale(false);
    } catch {
      setStale(true);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen?.();
  };

  return (
    <div
      ref={containerRef}
      className="min-h-dvh bg-background px-8 py-8 text-foreground xl:px-14 xl:py-12"
    >
      <div className="mx-auto flex h-full w-full max-w-[1800px] flex-col gap-10">
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="font-display text-[clamp(4rem,13vw,11rem)] leading-[0.85]">{time}</p>
            <p className="font-display mt-3 text-[clamp(1.2rem,2vw,2rem)] text-muted-foreground">
              {data.dateLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {stale ? (
              <span className="rounded-full border border-attention/40 px-3 py-1 text-xs text-attention">
                Reconnecting…
              </span>
            ) : null}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
              className="rounded-md border p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <Link
              href="/"
              aria-label="Back to dashboard"
              className="rounded-md border p-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-4" />
            </Link>
          </div>
        </header>

        <section className="border-y py-8">
          <p className="flex items-center gap-3 text-sm tracking-[0.2em] text-muted-foreground uppercase">
            <span className="size-2 rounded-full bg-brand" aria-hidden />
            Next
          </p>
          <p className="mt-3 text-[clamp(2.2rem,6vw,5rem)] leading-none">
            <span className="font-display text-hero">{data.nextAction.label}</span>
          </p>
          <p className="tabular mt-3 text-[clamp(1rem,1.5vw,1.5rem)] text-muted-foreground">
            {data.nextAction.detail ??
              `${data.checklist.done} of ${data.checklist.total} daily goals complete`}
          </p>
        </section>

        <section className="grid flex-1 gap-10 xl:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <div>
            <h2 className="mb-5 text-sm tracking-[0.2em] text-muted-foreground uppercase">Today</h2>
            {data.goals.length === 0 ? (
              <p className="text-lg text-muted-foreground">No goals are shown on the dashboard.</p>
            ) : (
              <ul className="grid gap-x-12 gap-y-7 sm:grid-cols-2">
                {data.goals.map((goal) => (
                  <li key={goal.id}>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[clamp(1rem,1.5vw,1.5rem)] font-medium">
                        {goal.name}
                      </span>
                      <span
                        className={cn(
                          "tabular text-[clamp(1.1rem,1.8vw,1.9rem)] font-semibold",
                          goal.status === "complete" && "text-positive",
                        )}
                      >
                        {goal.hasValue ? formatValue(goal.current) : "—"}
                        {goal.target !== null ? (
                          <span className="text-muted-foreground">
                            {" "}
                            / {formatValue(goal.target)}
                          </span>
                        ) : null}
                        {goal.unit ? (
                          <span className="ml-1 text-[0.7em] text-muted-foreground">
                            {goal.unit}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    {goal.trackingOnly ? null : (
                      <ProgressBar
                        value={goal.percent / 100}
                        size="lg"
                        tone={goal.status === "complete" ? "positive" : "neutral"}
                        label={`${goal.name}: ${goal.percent}% of target`}
                        className="mt-2.5"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-8 xl:border-l xl:pl-10">
            <div>
              <h2 className="mb-2 text-sm tracking-[0.2em] text-muted-foreground uppercase">Plan</h2>
              {data.plan.total === 0 ? (
                <p className="text-[clamp(1.1rem,1.6vw,1.6rem)] text-muted-foreground">Nothing planned</p>
              ) : (
                <>
                  <p className="text-[clamp(1.1rem,1.6vw,1.6rem)] font-medium">
                    {data.plan.current
                      ? `${data.plan.current.label} · until ${data.plan.current.endTime}`
                      : data.plan.next
                        ? `Next: ${data.plan.next.label} at ${data.plan.next.startTime}`
                        : "Plan complete"}
                  </p>
                  <p className="tabular text-muted-foreground">
                    {data.plan.done}/{data.plan.total} blocks done
                    {data.timer ? ` · timer running: ${data.timer.category}` : ""}
                  </p>
                </>
              )}
            </div>

            <div>
              <h2 className="mb-2 text-sm tracking-[0.2em] text-muted-foreground uppercase">Tasks</h2>
              <p className="text-[clamp(1.1rem,1.6vw,1.6rem)] font-medium">
                {data.tasks.next ?? "Nothing open"}
              </p>
              <p className="tabular text-muted-foreground">
                {data.tasks.open} open
                {data.tasks.overdue > 0 ? <span className="text-brand"> · {data.tasks.overdue} overdue</span> : null}
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-sm tracking-[0.2em] text-muted-foreground uppercase">Money</h2>
              <p className="tabular text-[clamp(1.4rem,2.4vw,2.4rem)] font-semibold">
                {formatMoney(data.money.spentToday, data.money.currency)}
              </p>
              <p className="tabular text-muted-foreground">
                spent today
                {data.money.nextBill
                  ? ` · ${data.money.nextBill.name} ${formatMoney(data.money.nextBill.amount, data.money.currency)} due ${data.money.nextBill.dueDate}`
                  : ""}
              </p>
            </div>

            <div>
              <h2 className="mb-2 text-sm tracking-[0.2em] text-muted-foreground uppercase">
                Training
              </h2>
              {data.workout ? (
                <>
                  <p className="text-[clamp(1.1rem,1.6vw,1.6rem)] font-medium">
                    {data.workout.name}
                  </p>
                  <p className="tabular text-muted-foreground">
                    {data.workout.completed ? "Completed" : "In progress"} ·{" "}
                    {data.workout.setsDone}/{data.workout.setsTotal} sets
                  </p>
                </>
              ) : (
                <p className="text-[clamp(1.1rem,1.6vw,1.6rem)] text-muted-foreground">
                  No session today
                </p>
              )}
            </div>

            <div>
              <h2 className="mb-2 text-sm tracking-[0.2em] text-muted-foreground uppercase">
                Weight
              </h2>
              <p className="tabular text-[clamp(1.4rem,2.4vw,2.4rem)] font-semibold">
                {data.weight.latest === null ? "—" : `${formatValue(data.weight.latest)} kg`}
              </p>
              <p className="tabular text-muted-foreground">
                {data.weight.sevenDayAverage !== null
                  ? `7-day avg ${formatValue(data.weight.sevenDayAverage)} kg`
                  : "No trend yet"}
                {data.weight.changeThisWeek !== null
                  ? ` · ${formatSigned(data.weight.changeThisWeek, 2)} kg`
                  : ""}
              </p>
            </div>

            <div>
              <h2 className="mb-3 text-sm tracking-[0.2em] text-muted-foreground uppercase">
                Last 7 days
              </h2>
              <dl className="space-y-3">
                <TrendRow
                  label="Calories"
                  value={formatValue(data.week.averages.calories)}
                  values={data.week.calories}
                />
                <TrendRow
                  label="Protein"
                  value={`${formatValue(data.week.averages.protein)} g`}
                  values={data.week.protein}
                />
                <TrendRow
                  label="Water"
                  value={`${formatValue(data.week.averages.waterMl / 1000, 1)} L`}
                  values={data.week.waterMl}
                />
                <TrendRow
                  label="Sleep"
                  value={
                    data.week.averages.sleepHours
                      ? formatDuration(data.week.averages.sleepHours)
                      : "—"
                  }
                  values={data.week.sleepHours}
                />
              </dl>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function TrendRow({
  label,
  value,
  values,
}: {
  label: string;
  value: string;
  values: number[];
}) {
  return (
    <div className="flex items-center gap-4">
      <dt className="w-20 text-sm text-muted-foreground">{label}</dt>
      <dd className="tabular w-20 text-sm font-medium">{value}</dd>
      <div className="flex-1">
        {values.some((entry) => entry > 0) ? (
          <Sparkline values={values} ariaLabel={`${label} over the last 7 days`} height={24} />
        ) : null}
      </div>
    </div>
  );
}
