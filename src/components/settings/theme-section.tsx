"use client";

import { useTheme } from "next-themes";
import { Card } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAction } from "@/components/common/use-action";
import { useMounted } from "@/components/common/use-mounted";
import { updateProfileAction } from "@/server/actions/settings";
import { THEMES, type Theme } from "@/lib/domain";

export function ThemeSection({ saved }: { saved: Theme }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const { run } = useAction();
  const current = (mounted ? (theme as Theme | undefined) : saved) ?? saved;

  return (
    <Card className="gap-4 p-4">
      <div>
        <h2 className="text-sm font-medium">Theme</h2>
        <p className="text-sm text-muted-foreground">Applied on this device and remembered on your profile.</p>
      </div>
      <ToggleGroup
        type="single"
        value={current}
        onValueChange={(value) => {
          if (!value) return;
          setTheme(value);
          run(() => updateProfileAction({ theme: value as Theme }));
        }}
        aria-label="Theme"
        className="justify-start"
      >
        {THEMES.map((option) => (
          <ToggleGroupItem key={option} value={option} className="capitalize">
            {option}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Card>
  );
}
