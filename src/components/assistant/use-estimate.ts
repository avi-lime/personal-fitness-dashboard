"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { EstimateInput, EstimateKind, EstimateOutput } from "@/assistant/estimate";

/**
 * Asks the assistant for a structured guess (macros, a category, task
 * fields). The form decides what to keep; nothing is written here.
 */
export function useEstimate() {
  const [pending, setPending] = useState(false);

  const estimate = useCallback(
    async <K extends EstimateKind>(kind: K, input: EstimateInput<K>): Promise<EstimateOutput<K> | null> => {
      setPending(true);
      try {
        const response = await fetch("/api/assistant/estimate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind, input }),
        });
        const json = (await response.json()) as { result?: EstimateOutput<K>; error?: string };
        if (!response.ok || !json.result) {
          toast.error(json.error ?? "Could not get an estimate.");
          return null;
        }
        return json.result;
      } catch {
        toast.error("Could not reach the assistant.");
        return null;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { pending, estimate };
}
