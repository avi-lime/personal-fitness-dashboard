"use client";

import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/common/use-action";
import { startPlannedWorkoutAction } from "@/server/actions/training";

/** Opens today's planned session and goes straight to the set-by-set screen. */
export function StartPlannedButton({ label, className }: { label: string; className?: string }) {
  const router = useRouter();
  const { pending, run } = useAction();
  return (
    <Button
      size="sm"
      className={className}
      disabled={pending}
      onClick={() =>
        run(() => startPlannedWorkoutAction({}), {
          onSuccess: (data) => router.push(`/training/session/${data.workoutId}`),
        })
      }
    >
      <Play className="size-3.5" aria-hidden /> {label}
    </Button>
  );
}
