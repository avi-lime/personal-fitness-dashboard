import { mcpHandler } from "@/mcp/handler";
import { withUrlToken } from "@/mcp/url-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * `/api/mcp/<MCP_TOKEN>` — the same MCP server for clients that cannot send an
 * `Authorization` header, e.g. ChatGPT connectors set to "No authentication".
 *
 * The path segment is turned into a bearer header and verified exactly like a
 * header token, so a wrong token still gets the normal 401. Treat the URL as
 * a secret: anyone who has it can read and write everything.
 */
async function handle(request: Request, { params }: RouteContext<"/api/mcp/[token]">) {
  const { token } = await params;
  return mcpHandler(withUrlToken(request, token));
}

export { handle as GET, handle as POST, handle as DELETE };
