import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { getEnv } from "@/lib/env";
import { ensureOwnerUser } from "@/server/auth";

export const MCP_SCOPES = ["dashboard:read", "dashboard:write"] as const;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

/**
 * Bearer-token verification for the MCP endpoint.
 *
 * The token is a single shared secret (`MCP_TOKEN`) that identifies the owner
 * of this deployment. Returning `undefined` makes `withMcpAuth` answer 401 with
 * a `WWW-Authenticate` challenge; the token itself is never echoed back.
 */
export async function verifyMcpToken(
  _request: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  const expected = getEnv().MCP_TOKEN;
  if (!expected || !bearerToken) return undefined;
  if (!safeEqual(bearerToken, expected)) return undefined;

  const user = await ensureOwnerUser();
  return {
    token: bearerToken,
    clientId: "life-dashboard-mcp",
    scopes: [...MCP_SCOPES],
    extra: { userId: user.id, username: user.username },
  };
}

export function isMcpConfigured(): boolean {
  try {
    return Boolean(getEnv().MCP_TOKEN);
  } catch {
    return false;
  }
}
