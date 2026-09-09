import { cn } from "@/lib/utils";

/** Trend glyph: no axes, no labels, just the shape of the last N values. */
export function Sparkline({
  values,
  className,
  ariaLabel,
  width = 120,
  height = 32,
}: {
  values: number[];
  className?: string;
  ariaLabel: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const path = values
    .map((value, index) => {
      const x = index * step;
      const y = height - 2 - ((value - min) / range) * (height - 4);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-8 w-full", className)}
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        className="stroke-foreground/70"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
