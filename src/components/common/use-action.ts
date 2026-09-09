"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";

interface RunOptions<T> {
  success?: string;
  onSuccess?: (data: T) => void;
}

/**
 * Calls a server action inside a transition and reports the outcome once, so
 * no component has to repeat pending/toast handling.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(action: () => Promise<ActionResult<T>>, options: RunOptions<T> = {}) => {
      startTransition(async () => {
        try {
          const result = await action();
          if (result.ok) {
            if (options.success) toast.success(options.success);
            options.onSuccess?.(result.data);
          } else {
            toast.error(result.error);
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Something went wrong");
        }
      });
    },
    [],
  );

  return { pending, run };
}
