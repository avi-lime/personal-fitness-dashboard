"use client";

import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { ConfirmButton } from "@/components/common/confirm-button";
import { deleteAllDataAction, importDataAction } from "@/server/actions/settings";

/** Export, import and irreversible deletion. Deletion needs typed confirmation. */
export function DataSection() {
  const [confirmation, setConfirmation] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const { pending, run } = useAction();

  const onFile = async (file: File) => {
    const text = await file.text();
    run(() => importDataAction(text), {
      onSuccess: () => {
        if (fileInput.current) fileInput.current.value = "";
      },
      success: "Import complete",
    });
  };

  return (
    <Card className="gap-4 p-4">
      <div>
        <h2 className="text-sm font-medium">Data</h2>
        <p className="text-sm text-muted-foreground">
          Your data stays in your own database. Exports contain everything.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href="/api/export?format=json" download>
            <Download className="size-4" aria-hidden /> Export JSON
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/export?format=csv" download>
            <Download className="size-4" aria-hidden /> Export daily CSV
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => fileInput.current?.click()}
        >
          <Upload className="size-4" aria-hidden /> Import JSON
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Import a JSON export"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />
      </div>

      <div className="space-y-3 rounded-md border border-destructive/40 p-3">
        <div>
          <h3 className="text-sm font-medium text-destructive">Delete all data</h3>
          <p className="text-sm text-muted-foreground">
            Removes every goal, log, workout and note. The account itself is kept. This cannot be
            undone.
          </p>
        </div>
        <Field id="delete-confirm" label="Type DELETE to confirm">
          <Input
            id="delete-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="max-w-xs"
            autoComplete="off"
          />
        </Field>
        <ConfirmButton
          variant="destructive"
          size="sm"
          disabled={pending || confirmation !== "DELETE"}
          title="Permanently delete all of your data?"
          description="Every goal, log, task, application, transaction and note is removed. There is no undo."
          confirmLabel="Delete everything"
          onConfirm={() =>
            run(() => deleteAllDataAction(confirmation), {
              success: "All data deleted",
              onSuccess: () => setConfirmation(""),
            })
          }
        >
          <Trash2 className="size-4" aria-hidden /> Delete everything
        </ConfirmButton>
      </div>
    </Card>
  );
}
