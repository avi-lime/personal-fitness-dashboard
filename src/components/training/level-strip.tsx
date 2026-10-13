import { Coins } from "lucide-react";
import { ProgressBar } from "@/components/charts/progress-bar";
import type { RpgView } from "@/server/services/training";

/** Level, title, XP to the next level and gold — the game at a glance. */
export function LevelStrip({ rpg }: { rpg: RpgView }) {
  const { level } = rpg;
  const toGo = level.needed - level.current;
  return (
    <div className="flex items-center gap-4">
      <div
        className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-3 ring-1 ring-brand/40"
        aria-label={`Level ${level.level}`}
      >
        <span className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">Lv</span>
        <span className="font-display -mt-1 text-2xl leading-none text-brand">{level.level}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate font-medium">{rpg.title}</p>
          <p className="flex shrink-0 items-center gap-1 text-sm tabular" title="Gold, earned from missions">
            <Coins className="size-3.5 text-brand" aria-hidden />
            {rpg.gold}
          </p>
        </div>
        <ProgressBar value={level.progress} tone="brand" label={`${level.current} of ${level.needed} XP to level ${level.level + 1}`} />
        <p className="text-xs text-muted-foreground tabular">
          {rpg.xp.total.toLocaleString()} XP · {toGo.toLocaleString()} to level {level.level + 1}
        </p>
      </div>
    </div>
  );
}
