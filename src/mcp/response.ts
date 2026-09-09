import type { CallToolResult } from "@modelcontextprotocol/server";

/**
 * Tools answer with a short human-readable line *and* the same information as
 * structured JSON, so a model can read either without re-parsing prose.
 */
export function toolResult(summary: string, data: unknown): CallToolResult {
  return {
    content: [
      { type: "text", text: summary },
      { type: "text", text: JSON.stringify(data, null, 2) },
    ],
    structuredContent: data as Record<string, unknown>,
  };
}

export function toolError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
