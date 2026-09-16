import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlanDayButton } from "@/components/dashboard/plan-day-button";
import type { TimeBlock } from "@/db/schema";
import { cn } from "@/lib/utils";

export function PlanCard({
  blocks,
  now,
  currentId,
}: {
  blocks: TimeBlock[];
  now: string;
  currentId: string | null;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Today&rsquo;s plan</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/plan">Open</Link>
        </Button>
      </div>
      {blocks.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
          <span>Nothing planned yet.</span>
          <PlanDayButton />
        </div>
      ) : (
        <ol className="divide-y">
          {blocks.map((block) => {
            const active = block.id === currentId;
            const past = block.endTime <= now;
            return (
              <li
                key={block.id}
                className={cn(
                  "flex items-center gap-3 py-1.5 text-sm",
                  past && !block.done && "text-muted-foreground",
                )}
              >
                <span className={cn("tabular w-24 text-xs", active ? "text-brand" : "text-muted-foreground")}>
                  {block.startTime}–{block.endTime}
                </span>
                <span className={cn("min-w-0 flex-1 truncate", block.done && "line-through text-muted-foreground")}>
                  {block.label}
                </span>
                {active ? <span className="text-xs font-medium text-brand">now</span> : null}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
