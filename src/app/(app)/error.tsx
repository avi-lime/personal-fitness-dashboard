"use client";

import { useEffect } from "react";
import { ErrorView } from "@/components/common/error-view";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorView error={error} reset={reset} />;
}
