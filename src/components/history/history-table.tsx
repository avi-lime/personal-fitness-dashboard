import { Card } from "@/components/ui/card";
import { formatDuration, formatValue } from "@/lib/format";
import { formatShortDate } from "@/lib/date";
import type { DayFacts } from "@/lib/metrics";

const COLUMNS = [
  "Date",
  "Calories",
  "Protein",
  "Carbs",
  "Fat",
  "Water",
  "Sleep",
  "Workouts",
  "Weight",
] as const;

export function HistoryTable({ days }: { days: DayFacts[] }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b text-left text-xs text-muted-foreground">
              {COLUMNS.map((column) => (
                <th key={column} className="px-4 py-2.5 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {days.map((day) => (
              <tr key={day.date} className="tabular">
                <td className="px-4 py-2 whitespace-nowrap">{formatShortDate(day.date)}</td>
                <td className="px-4 py-2">{day.calories ? formatValue(day.calories) : "—"}</td>
                <td className="px-4 py-2">{day.protein ? `${formatValue(day.protein)} g` : "—"}</td>
                <td className="px-4 py-2">{day.carbs ? `${formatValue(day.carbs)} g` : "—"}</td>
                <td className="px-4 py-2">{day.fat ? `${formatValue(day.fat)} g` : "—"}</td>
                <td className="px-4 py-2">
                  {day.waterMl ? `${formatValue(day.waterMl / 1000, 2)} L` : "—"}
                </td>
                <td className="px-4 py-2">
                  {day.sleepHours ? formatDuration(day.sleepHours) : "—"}
                </td>
                <td className="px-4 py-2">{day.workoutCount || "—"}</td>
                <td className="px-4 py-2">
                  {day.weightKg === null ? "—" : `${formatValue(day.weightKg, 2)} kg`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
