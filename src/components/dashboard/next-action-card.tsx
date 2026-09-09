import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/charts/progress-bar";
import type { NextAction } from "@/lib/next-action";

export function NextActionCard({
  action,
  checklist,
  checklistTotal,
  checklistDone,
}: {
  action: NextAction;
  checklist: number;
  checklistTotal: number;
  checklistDone: number;
}) {
  return (
    <Card className="gap-0 p-5 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Next
          </p>
          <p className="mt-1.5 flex items-start gap-2 text-2xl font-semibold tracking-tight lg:items-center lg:text-3xl">
            {action.type === "goal" ? (
              <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground lg:mt-0" aria-hidden />
            ) : null}
            <span className="min-w-0 break-words">{action.label}</span>
          </p>
          {action.detail ? (
            <p className="tabular mt-1 text-sm text-muted-foreground">{action.detail}</p>
          ) : null}
        </div>

        <div className="min-w-40">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Checklist
          </p>
          <p className="tabular mt-1.5 text-2xl font-semibold">
            {checklistDone}
            <span className="text-base font-normal text-muted-foreground"> / {checklistTotal}</span>
          </p>
          <ProgressBar
            value={checklist}
            tone={checklist >= 1 ? "positive" : "neutral"}
            label={`Daily checklist: ${checklistDone} of ${checklistTotal} complete`}
            className="mt-2"
          />
        </div>
      </div>
    </Card>
  );
}
