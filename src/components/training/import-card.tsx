"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAction } from "@/components/common/use-action";
import { importHistoryAction } from "@/server/actions/training";
import type { ImportSummary } from "@/server/services/import";
import { formatShortDate } from "@/lib/date";

const MAX_BYTES = 4_000_000;

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * History from Strong, Hevy or FitNotes. The file is read in the browser and
 * previewed before anything is written, so the numbers can be checked first.
 */
export function ImportCard() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportSummary | null>(null);
  const { pending, run } = useAction();

  const choose = async (picked: File | undefined) => {
    if (!picked) return;
    if (picked.size > MAX_BYTES) {
      toast.error("That file is over 4 MB. Export a shorter date range and import it in parts.");
      return;
    }
    const text = await picked.text();
    setFile({ name: picked.name, text });
    run(() => importHistoryAction({ text, commit: false }), { onSuccess: setPreview });
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (input.current) input.current.value = "";
  };

  return (
    <Card className="gap-3 p-4">
      <div>
        <h3 className="text-sm font-medium">Import history</h3>
        <p className="text-xs text-muted-foreground">
          A CSV export from Strong, Hevy or FitNotes. Days you have already logged here are left alone, so
          importing the same file twice never duplicates anything.
        </p>
      </div>

      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => void choose(event.target.files?.[0])}
        aria-label="Workout export file"
      />

      {!preview ? (
        <Button variant="outline" size="sm" className="w-fit" disabled={pending} onClick={() => input.current?.click()}>
          <Upload className="size-3.5" aria-hidden /> {pending ? "Reading…" : "Choose a file"}
        </Button>
      ) : (
        <div className="space-y-3 rounded-xl bg-surface-3 p-3 text-sm">
          <p>
            <span className="font-medium">{preview.source ?? "A workout file"}</span>
            <span className="text-muted-foreground"> · {file?.name}</span>
          </p>
          <ul className="space-y-1 text-muted-foreground tabular">
            <li>
              <span className="text-foreground">{preview.added}</span> of {count(preview.workouts, "workout")} to add
              {preview.from && preview.to ? ` (${formatShortDate(preview.from)} – ${formatShortDate(preview.to)})` : ""}
              {preview.skippedDays > 0 ? `; ${preview.skippedDays} on days already logged are skipped` : ""}.
            </li>
            <li>
              {count(preview.sets, "set")}{preview.warmups > 0 ? `, ${count(preview.warmups, "warm-up")} among them` : ""}.
            </li>
            <li>
              {preview.recognised} of {count(preview.exercises, "exercise")} recognised and counted toward your muscles.
            </li>
            {preview.convertedFromLb ? <li>Weights in pounds were converted to kilograms.</li> : null}
            {preview.cardioSkipped > 0 ? <li>{count(preview.cardioSkipped, "cardio row")} skipped — cardio isn&rsquo;t tracked here.</li> : null}
            {preview.skippedRows > 0 ? <li>{count(preview.skippedRows, "unreadable row")} skipped.</li> : null}
          </ul>
          {preview.unrecognised.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Logged, but not placed on a muscle: {preview.unrecognised.join(", ")}.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={pending || preview.added === 0 || !file}
              onClick={() =>
                file &&
                run(() => importHistoryAction({ text: file.text, commit: true }), {
                  onSuccess: (done) => {
                    toast.success(`Imported ${count(done.added, "workout")}`);
                    reset();
                  },
                })
              }
            >
              {preview.added === 0 ? "Nothing new to import" : `Import ${count(preview.added, "workout")}`}
            </Button>
            <Button variant="ghost" size="sm" disabled={pending} onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
