import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Quiet by design: a sentence, optionally one inline action. No dashed box —
 * an empty section should read as "nothing here yet", not as a call-out.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 py-4 text-sm", className)}>
      <p>
        <span className="font-medium">{title}</span>
        {description ? <span className="text-muted-foreground"> {description}</span> : null}
      </p>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
