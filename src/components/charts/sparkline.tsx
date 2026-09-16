import { cn } from "@/lib/utils";

/** Trend glyph: the shape of the last N values over a faint baseline, drawn at true proportions. */
export function Sparkline({
  values,
  className,
  ariaLabel,
  width = 160,
  height = 36,
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
  const yOf = (value: number) => height - 3 - ((value - min) / range) * (height - 6);
  const path = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${(index * step).toFixed(2)},${yOf(value).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      className={cn("h-9 w-full", className)}
      role="img"
      aria-label={ariaLabel}
    >
      <line x1={0} x2={width} y1={height - 3} y2={height - 3} className="stroke-border" strokeWidth={1} />
      <path d={path} fill="none" className="stroke-foreground/70" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(values.length - 1) * step} cy={yOf(values[values.length - 1])} r={2} className="fill-foreground" />
    </svg>
  );
}
