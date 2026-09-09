"use client";

import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/components/common/use-mounted";

const ORDER = ["system", "light", "dark"] as const;

/** Cycles system → light → dark. One button, no menu. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  const current = (theme ?? "system") as (typeof ORDER)[number];
  const Icon = current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Theme: ${mounted ? current : "system"}. Click to change.`}
      title={`Theme: ${mounted ? current : "system"}`}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])}
    >
      {mounted ? <Icon className="size-4" /> : <Monitor className="size-4" />}
    </Button>
  );
}
