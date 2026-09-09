"use client";

import { Apple, Droplet, Dumbbell, Moon, NotebookPen, Scale, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAction } from "@/components/common/use-action";
import { useLogDialogs, type LogDialogKind } from "@/components/log/log-provider";
import { logWaterAction } from "@/server/actions/logging";
import { WATER_PRESETS_ML } from "@/lib/water-presets";

const ACTIONS: Array<{ kind: LogDialogKind; label: string; icon: typeof Apple }> = [
  { kind: "food", label: "Log food", icon: Apple },
  { kind: "water", label: "Water", icon: Droplet },
  { kind: "weight", label: "Weight", icon: Scale },
  { kind: "sleep", label: "Sleep", icon: Moon },
  { kind: "workout", label: "Workout", icon: Dumbbell },
  { kind: "note", label: "Note", icon: NotebookPen },
];

export function QuickActions() {
  const { open } = useLogDialogs();
  const { pending, run } = useAction();

  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Quick actions</h2>
        <Button variant="ghost" size="sm" onClick={() => open("quick")} className="gap-1.5">
          <Zap className="size-3.5" aria-hidden />
          Quick entry
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">
        {ACTIONS.map((action) => (
          <Button
            key={action.kind}
            variant="secondary"
            onClick={() => open(action.kind)}
            className="h-auto flex-col gap-1.5 py-3"
          >
            <action.icon className="size-4" aria-hidden />
            <span className="text-xs font-normal">{action.label}</span>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <span className="text-xs text-muted-foreground">Water</span>
        {WATER_PRESETS_ML.map((amount) => (
          <Button
            key={amount}
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => logWaterAction({ milliliters: amount }), { success: `+${amount} ml water` })
            }
            className="tabular"
          >
            +{amount} ml
          </Button>
        ))}
      </div>
    </Card>
  );
}
