import Link from "next/link";
import { cn } from "@/lib/utils";

const RANGES = [7, 30, 90] as const;

export function RangeTabs({ active, basePath }: { active: number; basePath: string }) {
  return (
    <div className="flex gap-1" role="group" aria-label="History range">
      {RANGES.map((range) => (
        <Link
          key={range}
          href={`${basePath}?days=${range}`}
          aria-current={active === range ? "true" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            active === range
              ? "bg-secondary font-medium text-secondary-foreground"
              : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
          )}
        >
          {range} days
        </Link>
      ))}
    </div>
  );
}
