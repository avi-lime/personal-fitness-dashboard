import { cn } from "@/lib/utils";

/**
 * Progress indicator with an explicit accessible value. Colour carries meaning
 * only as reinforcement — the numbers beside it always state the same thing.
 */
export function ProgressBar({
  value,
  label,
  tone = "neutral",
  className,
  size = "default",
}: {
  /** 0..1 */
  value: number;
  label: string;
  tone?: "neutral" | "positive";
  className?: string;
  size?: "default" | "lg";
}) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        "w-full overflow-hidden rounded-full bg-track",
        size === "lg" ? "h-2.5" : "h-1.5",
        className,
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-300",
          tone === "positive" && "bg-positive",
          tone === "neutral" && "bg-foreground/70",
        )}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
