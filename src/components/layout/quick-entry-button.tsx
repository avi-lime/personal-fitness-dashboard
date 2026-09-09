"use client";

import { Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogDialogs } from "@/components/log/log-provider";

export function QuickEntryButton() {
  const { open } = useLogDialogs();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => open("quick")}
      className="gap-2 text-muted-foreground"
    >
      <Command className="size-3.5" aria-hidden />
      <span className="hidden sm:inline">Quick entry</span>
      <kbd className="ml-1 hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium md:inline">
        Ctrl K
      </kbd>
    </Button>
  );
}
