import "server-only";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { getProfileFor } from "@/server/auth";
import { toLocalDate, type LocalDate } from "@/lib/date";

export interface McpContext {
  userId: string;
  timezone: string;
  today: LocalDate;
}

export class McpAuthError extends Error {
  constructor(message = "This MCP request is not authenticated.") {
    super(message);
    this.name = "McpAuthError";
  }
}

/**
 * Every tool starts here. The user id comes from the verified token, never from
 * tool arguments, so no argument can reach another account's data.
 */
export async function resolveContext(authInfo: AuthInfo | undefined): Promise<McpContext> {
  const userId = authInfo?.extra?.userId;
  if (typeof userId !== "string" || userId.length === 0) throw new McpAuthError();

  const profile = await getProfileFor(userId);
  return {
    userId,
    timezone: profile.timezone,
    today: toLocalDate(new Date(), profile.timezone),
  };
}
