import "server-only";
import { db } from "@/db";
import { mcpAuditLog } from "@/db/schema";
import type { EntrySource } from "@/lib/domain";

/**
 * Appends a row for every mutation performed by a tool, with the tool name,
 * the arguments as received, a one-line summary of what changed and the
 * channel that asked for it (MCP client or the in-app assistant).
 */
export async function recordMutation(
  userId: string,
  tool: string,
  args: unknown,
  resultSummary: string,
  channel: EntrySource = "mcp",
): Promise<void> {
  await db.insert(mcpAuditLog).values({
    userId,
    tool,
    arguments: (args ?? {}) as Record<string, unknown>,
    resultSummary,
    channel,
  });
}
