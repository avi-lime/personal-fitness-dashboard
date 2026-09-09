import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/charts/progress-bar";
import { GoalQuickAdd } from "@/components/dashboard/goal-quick-add";
import { formatValue } from "@/lib/format";
import type { GoalLike, GoalProgress } from "@/lib/goals";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<GoalProgress["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  complete: "Complete",
};

export function GoalCard({ goal, progress }: { goal: GoalLike; progress: GoalProgress }) {
  const complete = progress.status === "complete";

  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium">{goal.name}</h3>
          <p className="text-xs text-muted-foreground">
            {goal.period === "daily" ? "Today" : `This ${goal.period.replace("_", " ")}`}
          </p>
        </div>
        <GoalQuickAdd
          goalId={goal.id}
          metricKey={goal.metricKey}
          type={goal.type}
          complete={complete}
        />
      </div>

      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="tabular text-2xl font-semibold">
          {progress.hasValue ? formatValue(progress.current) : "—"}
        </span>
        {progress.target !== null ? (
          <span className="tabular text-sm text-muted-foreground">
            / {formatValue(progress.target)}
          </span>
        ) : null}
        {goal.unit ? <span className="text-sm text-muted-foreground">{goal.unit}</span> : null}
      </div>

      {progress.trackingOnly ? (
        <p className="mt-3 text-xs text-muted-foreground">Tracking only — no target set.</p>
      ) : (
        <>
          <ProgressBar
            value={progress.progress}
            tone={complete ? "positive" : "neutral"}
            label={`${goal.name}: ${progress.percent}% of target`}
            className="mt-3"
          />
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={cn("text-muted-foreground", complete && "text-positive")}>
              {STATUS_LABEL[progress.status]}
            </span>
            <span className="tabular text-muted-foreground">{progress.percent}%</span>
          </div>
        </>
      )}
    </Card>
  );
}
