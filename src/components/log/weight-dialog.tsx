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
import { logWeightAction } from "@/server/actions/logging";

export function WeightDialog({
  open,
  onOpenChange,
  suggested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggested?: number | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log weight</DialogTitle>
          <DialogDescription>Recorded against the current date and time.</DialogDescription>
        </DialogHeader>
        {open ? (
          <WeightForm suggested={suggested} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so it always starts from fresh state. */
function WeightForm({
  suggested,
  onDone,
}: {
  suggested?: number | null;
  onDone: () => void;
}) {
  const [weight, setWeight] = useState(suggested ? String(suggested) : "");
  const [note, setNote] = useState("");
  const { pending, run } = useAction();
  const value = Number(weight.replace(",", "."));

  return (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            run(
              () =>
                logWeightAction({ kilograms: value, note: note.trim() === "" ? null : note.trim() }),
              { success: `Weight ${value} kg recorded`, onSuccess: onDone },
            );
          }}
        >
          <Field id="weight-value" label="Weight (kg)">
            <Input
              id="weight-value"
              inputMode="decimal"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              required
              autoFocus
              className="tabular text-lg"
            />
          </Field>
          <Field id="weight-note" label="Note">
            <Input
              id="weight-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="optional"
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending || !Number.isFinite(value) || value <= 0}>
              Save
            </Button>
          </DialogFooter>
        </form>
  );
}
