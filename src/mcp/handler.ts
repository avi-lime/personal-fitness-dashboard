import "server-only";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { registerTools } from "@/mcp/server";
import { SERVER_INSTRUCTIONS } from "@/mcp/instructions";
import { verifyMcpToken } from "@/mcp/auth";

/**
 * The one streamable-HTTP MCP handler, shared by `/api/mcp` (bearer header)
 * and `/api/mcp/<token>` (token in the URL). Requests without a valid token get
 * a 401 with a WWW-Authenticate challenge and never reach a tool.
 */
const handler = createMcpHandler(registerTools, {
  serverInfo: { name: "life-dashboard", version: "1.0.0" },
  instructions: SERVER_INSTRUCTIONS,
  capabilities: { tools: {} },
});

export const mcpHandler = withMcpAuth(handler, verifyMcpToken, { required: true });
