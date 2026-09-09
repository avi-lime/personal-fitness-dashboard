"use client";

import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/common/use-action";
import { useMounted } from "@/components/common/use-mounted";
import { updateProfileAction } from "@/server/actions/settings";
import { THEMES, type Theme } from "@/lib/domain";
import { cn } from "@/lib/utils";

export function ThemeSection({ saved }: { saved: Theme }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const { pending, run } = useAction();
  const current = (mounted ? (theme as Theme | undefined) : saved) ?? saved;

  return (
    <Card className="gap-4 p-4">
      <div>
        <h2 className="text-sm font-medium">Theme</h2>
        <p className="text-sm text-muted-foreground">
          Applied on this device and remembered on your profile.
        </p>
      </div>
      <div className="flex gap-2">
        {THEMES.map((option) => (
          <Button
            key={option}
            variant={current === option ? "default" : "outline"}
            size="sm"
            disabled={pending}
            aria-pressed={current === option}
            className={cn("capitalize")}
            onClick={() => {
              setTheme(option);
              run(() => updateProfileAction({ theme: option }));
            }}
          >
            {option}
          </Button>
        ))}
      </div>
    </Card>
  );
}
