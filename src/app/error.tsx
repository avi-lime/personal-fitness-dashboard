"use client";

import { useEffect } from "react";
import { ErrorView } from "@/components/common/error-view";

/**
 * Root-segment boundary. This is what catches failures thrown by the
 * authenticated layout itself — a database outage, for example — which the
 * nested `(app)/error.tsx` cannot see.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorView error={error} reset={reset} title="The dashboard could not load" />;
}
