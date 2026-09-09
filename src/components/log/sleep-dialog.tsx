"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { logSleepAction } from "@/server/actions/logging";
import { formatDuration } from "@/lib/format";

/** `YYYY-MM-DDTHH:mm` in the browser's local time, for datetime-local inputs. */
function toInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function defaultNight(): { start: string; end: string } {
  const end = new Date();
  end.setHours(7, 0, 0, 0);
  if (end.getTime() > Date.now()) end.setDate(end.getDate() - 1);
  const start = new Date(end.getTime() - 7.5 * 3_600_000);
  return { start: toInputValue(start), end: toInputValue(end) };
}

export function SleepDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log sleep</DialogTitle>
          <DialogDescription>
            Attributed to the day you woke up. Quality is optional.
          </DialogDescription>
        </DialogHeader>
        {open ? <SleepForm onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SleepForm({ onDone }: { onDone: () => void }) {
  const night = defaultNight();
  const [start, setStart] = useState(night.start);
  const [end, setEnd] = useState(night.end);
  const [quality, setQuality] = useState("");
  const { pending, run } = useAction();

  const startAt = start ? new Date(start) : null;
  const endAt = end ? new Date(end) : null;
  const hours =
    startAt && endAt && endAt > startAt ? (endAt.getTime() - startAt.getTime()) / 3_600_000 : null;

  return (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!startAt || !endAt) return;
            run(
              () =>
                logSleepAction({
                  startTime: startAt.toISOString(),
                  endTime: endAt.toISOString(),
                  quality: quality === "" ? null : Number(quality),
                }),
              { success: "Sleep logged", onSuccess: onDone },
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="sleep-start" label="Fell asleep">
              <Input
                id="sleep-start"
                type="datetime-local"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
              />
            </Field>
            <Field id="sleep-end" label="Woke up">
              <Input
                id="sleep-end"
                type="datetime-local"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                required
              />
            </Field>
          </div>
          <Field id="sleep-quality" label="Quality (1–5)">
            <Input
              id="sleep-quality"
              type="number"
              min={1}
              max={5}
              value={quality}
              onChange={(event) => setQuality(event.target.value)}
              placeholder="optional"
            />
          </Field>
          <p className="tabular text-sm text-muted-foreground">
            {hours === null ? "Wake time must be after sleep time." : `Duration: ${formatDuration(hours)}`}
          </p>
          <DialogFooter>
            <Button type="submit" disabled={pending || hours === null}>
              Save
            </Button>
          </DialogFooter>
        </form>
  );
}
