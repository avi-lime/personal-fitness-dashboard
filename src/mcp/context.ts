import "server-only";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { getProfileFor } from "@/server/services/profile";
import { toLocalDate, type LocalDate } from "@/lib/date";
import type { EntrySource } from "@/lib/domain";

export interface McpContext {
  userId: string;
  timezone: string;
  today: LocalDate;
  /** Which channel is acting — stamped on every row a tool writes. */
  source: EntrySource;
}

export class McpAuthError extends Error {
  constructor(message = "This MCP request is not authenticated.") {
    super(message);
    this.name = "McpAuthError";
  }
}

/** Builds a tool context for an already-authenticated user. */
export async function contextForUser(userId: string, source: EntrySource): Promise<McpContext> {
  const profile = await getProfileFor(userId);
  return {
    userId,
    timezone: profile.timezone,
    today: toLocalDate(new Date(), profile.timezone),
    source,
  };
}

/**
 * Every MCP tool starts here. The user id comes from the verified token, never
 * from tool arguments, so no argument can reach another account's data.
 */
export async function resolveContext(authInfo: AuthInfo | undefined): Promise<McpContext> {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string" || userId.length === 0) throw new McpAuthError();
  const source: EntrySource = authInfo?.extra?.channel === "chatgpt" ? "chatgpt" : "mcp";
  return contextForUser(userId, source);
}
