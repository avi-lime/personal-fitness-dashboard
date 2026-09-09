import { formatShortDate } from "@/lib/date";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface LinePoint {
  label: string;
  value: number;
}

/**
 * A small, dependency-free line chart. Drawn in a fixed user-space viewBox and
 * scaled uniformly, so labels stay legible at any width.
 */
export function LineChart({
  points,
  height = 180,
  width = 640,
  unit,
  className,
  ariaLabel,
}: {
  points: LinePoint[];
  height?: number;
  width?: number;
  unit?: string;
  className?: string;
  ariaLabel: string;
}) {
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No data to chart yet.</p>
    );
  }

  const padding = { top: 12, right: 12, bottom: 24, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const span = rawMax - rawMin || Math.max(1, Math.abs(rawMax) * 0.1);
  const min = rawMin - span * 0.15;
  const max = rawMax + span * 0.15;

  const x = (index: number) =>
    padding.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const y = (value: number) => padding.top + innerHeight - ((value - min) / (max - min)) * innerHeight;

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`).join(" ");
  const area = `${line} L${x(points.length - 1)},${padding.top + innerHeight} L${x(0)},${
    padding.top + innerHeight
  } Z`;

  const ticks = [max, (max + min) / 2, min];
  const labelEvery = Math.max(1, Math.ceil(points.length / 7));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={y(tick)}
            y2={y(tick)}
            className="stroke-border"
            strokeWidth={1}
          />
          <text
            x={padding.left - 8}
            y={y(tick) + 3.5}
            textAnchor="end"
            className="fill-muted-foreground text-[10px]"
          >
            {formatValue(tick, 1)}
            {unit ? ` ${unit}` : ""}
          </text>
        </g>
      ))}

      <path d={area} className="fill-foreground/[0.06]" />
      <path
        d={line}
        fill="none"
        className="stroke-foreground"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((point, index) => (
        <circle
          key={`${point.label}-${index}`}
          cx={x(index)}
          cy={y(point.value)}
          r={points.length > 30 ? 1.5 : 2.5}
          className="fill-background stroke-foreground"
          strokeWidth={1.5}
        />
      ))}

      {points.map((point, index) =>
        index % labelEvery === 0 || index === points.length - 1 ? (
          <text
            key={`label-${point.label}-${index}`}
            x={x(index)}
            y={height - 6}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {point.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function toLinePoints(
  series: Array<{ date: string; value: number }>,
): LinePoint[] {
  return series.map((entry) => ({ label: formatShortDate(entry.date), value: entry.value }));
}
