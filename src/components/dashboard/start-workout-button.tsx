"use client";

import { Button } from "@/components/ui/button";
import { useLogDialogs } from "@/components/log/log-provider";

export function StartWorkoutButton({ label = "Start workout" }: { label?: string }) {
  const { open } = useLogDialogs();
  return (
    <Button size="sm" onClick={() => open("workout")}>
      {label}
    </Button>
  );
}
