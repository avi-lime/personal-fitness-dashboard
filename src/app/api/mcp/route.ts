import { mcpHandler } from "@/mcp/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Streamable-HTTP MCP endpoint: `Authorization: Bearer $MCP_TOKEN`.
 * Excluded from the session proxy in `src/proxy.ts`.
 */
export { mcpHandler as GET, mcpHandler as POST, mcpHandler as DELETE };
