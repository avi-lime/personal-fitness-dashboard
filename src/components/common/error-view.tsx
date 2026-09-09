"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { describeError, isDatabaseUnreachable } from "@/lib/errors";

/**
 * Shared body for the route error boundaries.
 *
 * In production Next redacts server-side error messages, so an unidentifiable
 * error still gets an actionable hint rather than a bare apology.
 */
export function ErrorView({
  error,
  reset,
  title = "Something went wrong",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  const message = describeError(error, "The page could not be loaded.");
  const identified = isDatabaseUnreachable(error) || (error.message?.trim() ?? "") !== "";

  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      {identified ? null : (
        <p className="text-sm text-muted-foreground">
          The most common cause is the database being unreachable. Check that it is running and
          that <code className="font-mono text-xs">DATABASE_URL</code> is correct — locally,{" "}
          <code className="font-mono text-xs">npm run db:up</code> starts it.
        </p>
      )}
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/">Back to dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
