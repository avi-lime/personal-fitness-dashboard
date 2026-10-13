"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAction } from "@/components/common/use-action";
import { saveTrainingPreferencesAction } from "@/server/actions/training";
import { PROGRAMS, PROGRAM_KEYS, type ProgramKey } from "@/lib/fitness/programs";
import { EQUIPMENT_SETUPS, EQUIPMENT_SETUP_LABELS, type EquipmentSetup } from "@/lib/fitness/exercises";
import type { TrainingPreferences } from "@/server/services/training";
import { cn } from "@/lib/utils";

/**
 * How you train. Shown up front until it has been saved once, then tucked
 * behind "Change" — the plan works on sensible defaults in the meantime.
 */
export function SetupCard({
  preferences,
  onDone,
  compact = false,
}: {
  preferences: TrainingPreferences;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [program, setProgram] = useState<ProgramKey>(preferences.program);
  const [equipment, setEquipment] = useState<EquipmentSetup>(preferences.equipment);
  const [days, setDays] = useState(preferences.daysPerWeek);
  const { pending, run } = useAction();

  return (
    <Card className={cn("gap-4 p-4", compact && "bg-surface-3")}>
      {!compact ? (
        <div>
          <h2 className="font-medium">Set up your split</h2>
          <p className="text-sm text-muted-foreground">
            The planner builds every session from this. You can change it any time.
          </p>
        </div>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Split</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {PROGRAM_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setProgram(key)}
              aria-pressed={program === key}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                program === key ? "border-brand bg-brand/10" : "border-border hover:bg-accent",
              )}
            >
              <p className="text-sm font-medium">{PROGRAMS[key].name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{PROGRAMS[key].summary}</p>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Sessions a week</legend>
          <ToggleGroup
            type="single"
            value={String(days)}
            onValueChange={(value) => value && setDays(Number(value))}
            className="flex-wrap justify-start"
          >
            {[2, 3, 4, 5, 6].map((count) => (
              <ToggleGroupItem key={count} value={String(count)} className="min-w-10 tabular">
                {count}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {PROGRAMS[program].name} suits {PROGRAMS[program].suggestedDays.join(", ")} days.
          </p>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs tracking-wide text-muted-foreground uppercase">Equipment</legend>
          <ToggleGroup
            type="single"
            value={equipment}
            onValueChange={(value) => value && setEquipment(value as EquipmentSetup)}
            className="flex-wrap justify-start"
          >
            {EQUIPMENT_SETUPS.map((setup) => (
              <ToggleGroupItem key={setup} value={setup}>
                {EQUIPMENT_SETUP_LABELS[setup]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </fieldset>
      </div>

      <div className="flex justify-end gap-2">
        {onDone ? (
          <Button variant="ghost" size="sm" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            run(() => saveTrainingPreferencesAction({ program, equipment, daysPerWeek: days }), {
              success: "Training plan saved",
              onSuccess: onDone,
            })
          }
        >
          Save
        </Button>
      </div>
    </Card>
  );
}
