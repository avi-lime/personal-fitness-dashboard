"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { useLogDialogs } from "@/components/log/log-provider";
import { deleteSleepAction } from "@/server/actions/logging";
import { formatDuration } from "@/lib/format";

export interface SleepEntryView {
  id: string;
  date: string;
  start: string;
  end: string;
  hours: number;
  quality: number | null;
  note: string | null;
}

export function SleepPanel({ entries }: { entries: SleepEntryView[] }) {
  const { open } = useLogDialogs();
  const { pending, run } = useAction();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Sleep</h2>
        <Button size="sm" onClick={() => open("sleep")}>
          Log sleep
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState title="No sleep logged" description="Record last night to start tracking." />
      ) : (
        <Card className="gap-0 p-0">
          <ul className="divide-y">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-4 px-4 py-2.5">
                <span className="tabular w-28 text-sm">{entry.date}</span>
                <span className="tabular w-32 text-sm text-muted-foreground">
                  {entry.start} → {entry.end}
                </span>
                <span className="tabular flex-1 text-sm font-medium">
                  {formatDuration(entry.hours)}
                </span>
                {entry.quality !== null ? (
                  <span className="text-sm text-muted-foreground">Quality {entry.quality}/5</span>
                ) : null}
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={pending}
                  aria-label={`Delete sleep entry for ${entry.date}`}
                  onClick={() => run(() => deleteSleepAction(entry.id), { success: "Entry deleted" })}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
