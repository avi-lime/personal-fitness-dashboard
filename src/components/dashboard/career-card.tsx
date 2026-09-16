import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APPLICATION_STAGE_LABELS } from "@/lib/domain";
import { formatShortDate } from "@/lib/date";
import type { Application } from "@/db/schema";

export function CareerCard({ active, nextStepsDue }: { active: Application[]; nextStepsDue: Application[] }) {
  const interviewing = active.filter((app) => app.stage === "interview" || app.stage === "offer");
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Career</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/career">Open</Link>
        </Button>
      </div>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">No applications in the pipeline.</p>
      ) : (
        <>
          <p className="text-sm">
            <span className="tabular font-medium">{active.length}</span> in pipeline
            {interviewing.length > 0 ? (
              <>
                {" · "}
                <span className="tabular font-medium">{interviewing.length}</span> interviewing
              </>
            ) : null}
          </p>
          {nextStepsDue.length > 0 ? (
            <ul className="space-y-1 border-t pt-3 text-sm">
              {nextStepsDue.slice(0, 3).map((app) => (
                <li key={app.id} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    <span className="text-brand">{app.nextStep ?? "Next step"}</span>
                    <span className="text-muted-foreground"> · {app.company}</span>
                  </span>
                  <span className="tabular text-xs text-muted-foreground">
                    {app.nextStepDate ? formatShortDate(app.nextStepDate) : APPLICATION_STAGE_LABELS[app.stage]}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Card>
  );
}
