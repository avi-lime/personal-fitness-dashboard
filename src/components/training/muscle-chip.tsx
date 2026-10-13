import { MUSCLE_META, type Muscle } from "@/lib/fitness/muscles";
import type { MuscleState } from "@/lib/fitness/status";
import { cn } from "@/lib/utils";

/** Visual language shared by the map, chips and lists: hot, fresh, cold. */
export const STATE_STYLE: Record<MuscleState, { label: string; dot: string; fill: string }> = {
  recovering: { label: "Recovering", dot: "bg-brand", fill: "var(--brand)" },
  ready: { label: "Ready", dot: "bg-positive", fill: "var(--positive)" },
  due: { label: "Due", dot: "bg-muted-foreground", fill: "color-mix(in oklch, var(--muted-foreground) 55%, transparent)" },
  neglected: { label: "Neglected", dot: "bg-muted-foreground/40", fill: "color-mix(in oklch, var(--muted-foreground) 25%, transparent)" },
};

export function MuscleChip({
  muscle,
  state,
  detail,
  className,
}: {
  muscle: Muscle;
  state?: MuscleState;
  detail?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-xs ring-1 ring-border",
        className,
      )}
    >
      {state ? <span className={cn("size-1.5 rounded-full", STATE_STYLE[state].dot)} aria-hidden /> : null}
      {MUSCLE_META[muscle].label}
      {detail ? <span className="text-muted-foreground tabular">{detail}</span> : null}
    </span>
  );
}
