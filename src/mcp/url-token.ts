/** Header the URL-token route sets so the audit log can tell ChatGPT apart from header-auth MCP clients. */
export const MCP_CHANNEL_HEADER = "x-mcp-channel";

/**
 * Rewrites a `/api/mcp/<token>` request into the equivalent `/api/mcp` request
 * with the token as a bearer header, for clients that cannot send headers
 * (ChatGPT's "no authentication" connectors).
 *
 * A real `Authorization` header always wins over the path token, so a client
 * that can authenticate properly is never downgraded.
 */
export function withUrlToken(request: Request, token: string): Request {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/\/api\/mcp\/[^/]+\/?$/, "/api/mcp");

  const headers = new Headers(request.headers);
  if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
  headers.set(MCP_CHANNEL_HEADER, "chatgpt");

  return new Request(url, {
    method: request.method,
    headers,
    body: request.body,
    // Node's fetch needs this to forward a streamed body.
    ...(request.body ? { duplex: "half" as const } : {}),
    signal: request.signal,
  });
}
