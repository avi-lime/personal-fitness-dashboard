"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetupCard } from "./setup-card";
import { PROGRAMS } from "@/lib/fitness/programs";
import { EQUIPMENT_SETUP_LABELS } from "@/lib/fitness/exercises";
import type { TrainingPreferences } from "@/server/services/training";

export function PreferencesDisclosure({ preferences }: { preferences: TrainingPreferences }) {
  const [open, setOpen] = useState(false);
  if (open) return <SetupCard preferences={preferences} onDone={() => setOpen(false)} compact />;
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>
        {PROGRAMS[preferences.program].name} · {preferences.daysPerWeek}×/week ·{" "}
        {EQUIPMENT_SETUP_LABELS[preferences.equipment]}
      </span>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Settings2 className="size-3.5" aria-hidden /> Change
      </Button>
    </div>
  );
}
