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
import { logWaterAction } from "@/server/actions/logging";
import { WATER_PRESETS_ML } from "@/lib/water-presets";

export function WaterDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [custom, setCustom] = useState("");
  const { pending, run } = useAction();

  const log = (milliliters: number) =>
    run(() => logWaterAction({ milliliters }), {
      success: `Logged ${milliliters} ml of water`,
      onSuccess: () => {
        setCustom("");
        onOpenChange(false);
      },
    });

  const customAmount = Number.parseInt(custom, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log water</DialogTitle>
          <DialogDescription>Pick a preset or enter an exact amount.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {WATER_PRESETS_ML.map((amount) => (
            <Button
              key={amount}
              variant="secondary"
              disabled={pending}
              onClick={() => log(amount)}
              className="tabular h-14 text-base"
            >
              {amount} ml
            </Button>
          ))}
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (Number.isFinite(customAmount) && customAmount > 0) log(customAmount);
          }}
          className="space-y-3"
        >
          <Field id="water-custom" label="Custom amount (ml)">
            <Input
              id="water-custom"
              inputMode="numeric"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              placeholder="e.g. 330"
            />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending || !Number.isFinite(customAmount)}>
              Log water
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
