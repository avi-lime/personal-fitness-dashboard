/** Number formatting shared by the UI, the MCP responses and monitor mode. */

export function formatValue(value: number, maxDecimals = 1): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10 ** maxDecimals) / 10 ** maxDecimals;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(maxDecimals);
}

export function formatWithUnit(value: number, unit?: string | null, maxDecimals = 1): string {
  const formatted = formatValue(value, maxDecimals);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

export function formatSigned(value: number, maxDecimals = 1): string {
  const formatted = formatValue(Math.abs(value), maxDecimals);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

export function formatDuration(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
