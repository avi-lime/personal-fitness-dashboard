import Link from "next/link";
import { formatValue } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Ring {
  key: string;
  label: string;
  href: string;
  /** What has been done, already in display units. */
  value: number;
  /** Null when there is no target to measure against. */
  target: number | null;
  unit: string;
  /** Overrides the "value / target" line, e.g. "Push day". */
  caption?: string;
  /** Overrides the percentage in the middle, e.g. "Go" before a session. */
  center?: string;
}

const SIZE = 64;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Today in four rings — calories, protein, water, training — so the first
 * glance at the phone answers "how am I doing?" without scrolling. Each ring
 * opens the page where that number is made.
 */
export function DayRings({ rings }: { rings: Ring[] }) {
  return (
    <ul className="grid grid-cols-4 gap-2">
      {rings.map((ring) => {
        const fraction = ring.target ? Math.min(1, ring.value / ring.target) : ring.value > 0 ? 1 : 0;
        const full = fraction >= 1;
        return (
          <li key={ring.key}>
            <Link
              href={ring.href}
              className="flex flex-col items-center gap-1.5 rounded-xl p-1.5 text-center transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
              aria-label={`${ring.label}: ${ring.caption ?? `${formatValue(ring.value)}${ring.target ? ` of ${formatValue(ring.target)}` : ""} ${ring.unit}`}`}
            >
              <span className="relative block size-16">
                <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-16 -rotate-90" aria-hidden>
                  <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-track" />
                  <circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={RADIUS}
                    fill="none"
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
                    className={cn("transition-[stroke-dashoffset] duration-500", full ? "stroke-positive" : "stroke-brand")}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-medium tabular">
                  {ring.center ?? (ring.target ? `${Math.round(fraction * 100)}%` : formatValue(ring.value))}
                </span>
              </span>
              <span className="text-xs font-medium">{ring.label}</span>
              <span className="-mt-1 text-[11px] leading-tight text-muted-foreground tabular">
                {ring.caption ?? `${formatValue(ring.value)}${ring.target ? `/${formatValue(ring.target)}` : ""} ${ring.unit}`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
