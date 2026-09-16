"use client";

import { Button } from "@/components/ui/button";
import { useAction } from "@/components/common/use-action";
import { planDayAction } from "@/server/actions/plan";

export function PlanDayButton() {
  const { pending, run } = useAction();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => run(() => planDayAction(null), { success: "Day planned from your routines" })}
    >
      Plan my day
    </Button>
  );
}
