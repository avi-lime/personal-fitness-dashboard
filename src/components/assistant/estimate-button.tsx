"use client";

import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogDialogs } from "@/components/log/log-provider";

/** A small "let the assistant fill this in" affordance; hidden when there is no model. */
export function EstimateButton({
  onClick,
  pending,
  disabled,
  label = "Estimate",
  title,
}: {
  onClick: () => void;
  pending: boolean;
  disabled?: boolean;
  label?: string;
  title?: string;
}) {
  const { assistantEnabled } = useLogDialogs();
  if (!assistantEnabled) return null;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={pending || disabled}
      title={title ?? "Ask the assistant for a sensible value"}
    >
      <Calculator className="size-3.5" aria-hidden />
      {pending ? "Estimating…" : label}
    </Button>
  );
}
