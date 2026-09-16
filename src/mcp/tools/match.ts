import { ToolFailure } from "./write";

/**
 * Resolves "the resume task" to a row without the model juggling UUIDs.
 * Exact (case-insensitive) match wins; otherwise a unique substring match;
 * anything else is a clear error the model can relay or refine.
 */
export function findOneByName<T>(
  rows: readonly T[],
  query: string,
  name: (row: T) => string,
  what: string,
): T {
  const needle = query.trim().toLowerCase();
  if (!needle) throw new ToolFailure(`No ${what} name given.`);

  const exact = rows.filter((row) => name(row).trim().toLowerCase() === needle);
  if (exact.length === 1) return exact[0];

  const partial = rows.filter((row) => name(row).toLowerCase().includes(needle));
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) throw new ToolFailure(`No ${what} matching "${query}".`);
  throw new ToolFailure(
    `Ambiguous ${what} "${query}": ${partial.slice(0, 5).map(name).join(", ")}. Be more specific.`,
  );
}
