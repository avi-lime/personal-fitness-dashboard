import { ProgressBar } from "@/components/charts/progress-bar";
import { STATE_STYLE } from "./muscle-chip";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, MUSCLE_META } from "@/lib/fitness/muscles";
import type { MuscleView } from "@/server/services/training";
import { cn } from "@/lib/utils";

/** Every muscle by group: level, state and this week's sets against target. */
export function MuscleList({ muscles }: { muscles: MuscleView[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {MUSCLE_GROUPS.map((group) => (
        <section key={group} className="space-y-2">
          <h3 className="text-xs tracking-widest text-muted-foreground uppercase">{MUSCLE_GROUP_LABELS[group]}</h3>
          <ul className="space-y-2">
            {muscles
              .filter((muscle) => MUSCLE_META[muscle.muscle].group === group)
              .map((muscle) => (
                <li key={muscle.muscle} className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={cn("size-2 shrink-0 rounded-full", STATE_STYLE[muscle.state].dot)} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{MUSCLE_META[muscle.muscle].label}</span>
                    <span className="text-xs text-muted-foreground tabular">
                      {muscle.state === "recovering"
                        ? `${Math.round(muscle.recovery * 100)}%`
                        : muscle.daysSince === null
                          ? "never"
                          : `${muscle.daysSince}d`}
                    </span>
                    <span className="w-10 text-right text-xs tabular">Lv {muscle.level.level}</span>
                  </div>
                  <ProgressBar
                    value={muscle.weeklySets / muscle.weeklyTarget}
                    tone={muscle.weeklySets >= muscle.weeklyTarget ? "positive" : "neutral"}
                    label={`${MUSCLE_META[muscle.muscle].label}: ${muscle.weeklySets} of ${muscle.weeklyTarget} sets this week`}
                  />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
