import "server-only";
import { db } from "@/db";
import { mcpAuditLog } from "@/db/schema";

/**
 * Appends a row for every mutation performed over MCP, with the tool name, the
 * arguments as received and a one-line summary of what changed.
 */
export async function recordMutation(
  userId: string,
  tool: string,
  args: unknown,
  resultSummary: string,
): Promise<void> {
  await db.insert(mcpAuditLog).values({
    userId,
    tool,
    arguments: (args ?? {}) as Record<string, unknown>,
    resultSummary,
  });
}
