"use client";

import { Check, Coins, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/charts/progress-bar";
import { useAction } from "@/components/common/use-action";
import { claimMissionAction } from "@/server/actions/training";
import { formatValue } from "@/lib/format";
import type { Mission } from "@/lib/rpg/missions";
import { cn } from "@/lib/utils";

/** Missions with their progress; a finished one becomes a Claim button. */
export function MissionsList({ missions, title }: { missions: Mission[]; title?: string }) {
  const { pending, run } = useAction();
  if (missions.length === 0) return null;

  return (
    <section className="space-y-2">
      {title ? <h3 className="text-xs tracking-widest text-muted-foreground uppercase">{title}</h3> : null}
      <ul className="space-y-2">
        {missions.map((mission) => {
          const ready = mission.complete && !mission.claimed;
          return (
            <li
              key={`${mission.key}@${mission.period}`}
              className={cn(
                "rounded-xl bg-surface-3 p-3 ring-1 ring-border",
                ready && "ring-brand/60",
                mission.claimed && "opacity-60",
              )}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {mission.claimed ? <Check className="size-3.5 text-positive" aria-label="Claimed" /> : null}
                    {mission.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{mission.detail}</p>
                </div>
                {ready ? (
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() => claimMissionAction(mission.key), {
                        onSuccess: (reward) =>
                          toast.success(`+${reward.xp} XP · +${reward.gold} gold`, {
                            description: mission.title,
                            icon: <Sparkles className="size-4 text-brand" />,
                          }),
                      })
                    }
                  >
                    Claim
                  </Button>
                ) : (
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular">
                    <span>+{mission.xp} XP</span>
                    <span className="flex items-center gap-0.5">
                      <Coins className="size-3" aria-hidden />
                      {mission.gold}
                    </span>
                  </span>
                )}
              </div>
              {!mission.claimed && mission.target > 1 ? (
                <div className="mt-2 flex items-center gap-3">
                  <ProgressBar
                    value={mission.progress / mission.target}
                    tone={mission.complete ? "positive" : "brand"}
                    label={`${mission.progress} of ${mission.target}`}
                  />
                  <span className="shrink-0 text-xs text-muted-foreground tabular">
                    {formatValue(mission.progress)}/{formatValue(mission.target)}
                    {mission.unit ? ` ${mission.unit}` : ""}
                  </span>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
