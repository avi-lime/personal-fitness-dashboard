import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stat } from "@/components/common/stat";
import { EmptyState } from "@/components/common/empty-state";
import { ProgressBar } from "@/components/charts/progress-bar";
import { Sparkline } from "@/components/charts/sparkline";
import { requireContext } from "@/server/auth";
import { getWeeklySummary } from "@/server/services/summary";
import { addDays, formatLongDate, isLocalDate, startOfWeek, toLocalDate } from "@/lib/date";
import { formatDuration, formatPercent, formatSigned, formatValue } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Weekly review · Life Dashboard" };

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const { user, timezone } = await requireContext();
  const params = await searchParams;
  const requested = Array.isArray(params.weekStart) ? params.weekStart[0] : params.weekStart;
  const today = toLocalDate(new Date(), timezone);
  const weekStart =
    typeof requested === "string" && isLocalDate(requested)
      ? startOfWeek(requested)
      : startOfWeek(today);

  const review = await getWeeklySummary(user.id, weekStart);
  const { summary } = review;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Weekly review</h1>
          <p className="text-sm text-muted-foreground">
            {formatLongDate(review.weekStart, timezone)} — {formatLongDate(review.weekEnd, timezone)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/review?weekStart=${addDays(weekStart, -7)}`}>Previous week</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/review?weekStart=${addDays(weekStart, 7)}`}>Next week</Link>
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <Stat label="Calories" value={formatValue(summary.averages.calories)} detail="daily avg" />
          <Stat
            label="Protein"
            value={`${formatValue(summary.averages.protein)} g`}
            detail="daily avg"
          />
          <Stat
            label="Water"
            value={`${formatValue(summary.averages.waterMl / 1000, 2)} L`}
            detail="daily avg"
          />
          <Stat
            label="Sleep"
            value={summary.averages.sleepHours ? formatDuration(summary.averages.sleepHours) : "—"}
            detail="daily avg"
          />
          <Stat label="Workouts" value={summary.totals.workouts} detail="sessions" />
          <Stat
            label="Weight trend"
            value={
              summary.weight.changeThisWeek === null
                ? "—"
                : `${formatSigned(summary.weight.changeThisWeek, 2)} kg`
            }
            detail={
              summary.weight.latest === null
                ? "no weigh-ins"
                : `latest ${formatValue(summary.weight.latest)} kg`
            }
          />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="gap-2 p-4">
          <h2 className="text-sm font-medium">Strongest consistency</h2>
          {review.highlights.strongest ? (
            <>
              <p className="text-lg font-semibold">{review.highlights.strongest.name}</p>
              <p className="tabular text-sm text-muted-foreground">
                Met on {review.highlights.strongest.daysMet} of{" "}
                {review.highlights.strongest.daysTracked} days (
                {formatPercent(review.highlights.strongest.adherence)})
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Not enough data this week.</p>
          )}
        </Card>

        <Card className="gap-2 p-4">
          <h2 className="text-sm font-medium">Biggest miss</h2>
          {review.highlights.biggestMiss ? (
            <>
              <p className="text-lg font-semibold">{review.highlights.biggestMiss.name}</p>
              <p className="tabular text-sm text-muted-foreground">
                Met on {review.highlights.biggestMiss.daysMet} of{" "}
                {review.highlights.biggestMiss.daysTracked} days (
                {formatPercent(review.highlights.biggestMiss.adherence)})
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing stands out.</p>
          )}
        </Card>

        <Card className="gap-2 p-4">
          <h2 className="text-sm font-medium">Worth watching</h2>
          <p className="text-sm text-muted-foreground">
            {review.highlights.watch ?? "No notable movement this week."}
          </p>
        </Card>
      </div>

      <Card className="gap-4 p-4">
        <h2 className="text-sm font-medium">Goal adherence</h2>
        {review.adherence.length === 0 ? (
          <EmptyState title="No active goals" description="Add goals to see adherence here." />
        ) : (
          <ul className="space-y-3">
            {review.adherence.map((entry) => {
              const streak = review.streaks.find((item) => item.goalId === entry.goalId);
              return (
                <li key={entry.goalId} className="space-y-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{entry.name}</span>
                    <span className="tabular text-sm text-muted-foreground">
                      avg {formatValue(entry.average)}
                      {entry.unit ? ` ${entry.unit}` : ""}
                      {entry.target !== null
                        ? ` · target ${formatValue(entry.target)}${entry.unit ? ` ${entry.unit}` : ""}`
                        : ""}
                      {" · "}
                      {entry.daysMet}/{entry.daysTracked} days
                      {streak && streak.streak > 0 ? (
                        <Badge variant="secondary" className="ml-2">
                          {streak.streak}-day streak
                        </Badge>
                      ) : null}
                    </span>
                  </div>
                  <ProgressBar
                    value={entry.adherence}
                    tone={entry.adherence >= 0.8 ? "positive" : entry.adherence < 0.5 ? "attention" : "neutral"}
                    label={`${entry.name} adherence: ${formatPercent(entry.adherence)}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium">Daily shape</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Calories", values: review.days.map((day) => day.calories) },
              { label: "Protein", values: review.days.map((day) => day.protein) },
              { label: "Water", values: review.days.map((day) => day.waterMl) },
              { label: "Sleep", values: review.days.map((day) => day.sleepHours) },
            ].map((row) => (
              <div key={row.label} className="space-y-1">
                <p className="text-xs text-muted-foreground">{row.label}</p>
                {row.values.some((value) => value > 0) ? (
                  <Sparkline values={row.values} ariaLabel={`${row.label} across the week`} />
                ) : (
                  <p className="text-xs text-muted-foreground">No data</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="gap-3 p-4">
          <h2 className="text-sm font-medium">Notes this week</h2>
          {review.notes.length === 0 ? (
            <EmptyState title="No notes" description="Notes you add during the week appear here." />
          ) : (
            <ul className="space-y-2">
              {review.notes.map((note) => (
                <li key={note.id} className="rounded-md border px-3 py-2 text-sm">
                  <p className="tabular mb-0.5 text-xs text-muted-foreground">{note.localDate}</p>
                  {note.body}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
