import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "@/mcp/server";
import { SERVER_INSTRUCTIONS } from "@/mcp/instructions";
import { verifyMcpToken } from "@/mcp/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streamable-HTTP MCP endpoint.
 *
 * Excluded from the session proxy in `src/proxy.ts` because it authenticates
 * with a bearer token instead: `Authorization: Bearer $MCP_TOKEN`.
 * Requests without a valid token get a 401 with a WWW-Authenticate challenge
 * and never reach a tool.
 */
const handler = createMcpHandler(registerTools, {
  serverInfo: { name: "life-dashboard", version: "1.0.0" },
  instructions: SERVER_INSTRUCTIONS,
  capabilities: { tools: {} },
});

const authenticated = withMcpAuth(handler, verifyMcpToken, { required: true });

export { authenticated as GET, authenticated as POST, authenticated as DELETE };
