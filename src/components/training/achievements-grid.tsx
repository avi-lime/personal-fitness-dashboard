import { Lock, Trophy } from "lucide-react";
import { formatShortDate } from "@/lib/date";
import type { Achievement } from "@/lib/rpg/achievements";
import { cn } from "@/lib/utils";

export function AchievementsGrid({ achievements }: { achievements: Achievement[] }) {
  const unlocked = achievements.filter((entry) => entry.unlocked).length;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs tracking-widest text-muted-foreground uppercase">Achievements</h3>
        <p className="text-xs text-muted-foreground tabular">
          {unlocked} / {achievements.length}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {achievements.map((achievement) => (
          <li
            key={achievement.key}
            className={cn(
              "space-y-1 rounded-xl p-3 ring-1",
              achievement.unlocked ? "bg-brand/10 ring-brand/40" : "bg-surface-3 ring-border",
            )}
          >
            <div className="flex items-center gap-1.5">
              {achievement.unlocked ? (
                <Trophy className="size-3.5 text-brand" aria-hidden />
              ) : (
                <Lock className="size-3.5 text-muted-foreground" aria-hidden />
              )}
              <p className="truncate text-sm font-medium">{achievement.title}</p>
            </div>
            <p className="text-xs text-muted-foreground">{achievement.description}</p>
            <p className="text-xs tabular">
              {achievement.unlocked && achievement.unlockedOn ? (
                <span className="text-brand">
                  +{achievement.xp} XP · {formatShortDate(achievement.unlockedOn)}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {achievement.progress} / {achievement.target} · +{achievement.xp} XP
                </span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
