"use client";

import { Button } from "@/components/ui/button";
import { useLogDialogs } from "@/components/log/log-provider";

export function LogWeightButton({
  label = "Log weight",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "ghost" | "outline" | "secondary";
}) {
  const { open } = useLogDialogs();
  return (
    <Button size="sm" variant={variant} onClick={() => open("weight")}>
      {label}
    </Button>
  );
}
