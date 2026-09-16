import { describe, expect, it } from "vitest";
import { MCP_CHANNEL_HEADER, withUrlToken } from "@/mcp/url-token";

describe("withUrlToken", () => {
  it("moves the path token into a bearer header and strips it from the URL", async () => {
    const original = new Request("http://localhost:3000/api/mcp/s3cret?x=1", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
    });
    const forwarded = withUrlToken(original, "s3cret");

    expect(new URL(forwarded.url).pathname).toBe("/api/mcp");
    expect(new URL(forwarded.url).search).toBe("?x=1");
    expect(forwarded.method).toBe("POST");
    expect(forwarded.headers.get("authorization")).toBe("Bearer s3cret");
    expect(forwarded.headers.get(MCP_CHANNEL_HEADER)).toBe("chatgpt");
    expect(forwarded.headers.get("content-type")).toBe("application/json");
    await expect(forwarded.json()).resolves.toMatchObject({ method: "ping" });
  });

  it("never overrides a real Authorization header with the path token", () => {
    const original = new Request("http://localhost:3000/api/mcp/from-path", {
      headers: { authorization: "Bearer from-header" },
    });
    expect(withUrlToken(original, "from-path").headers.get("authorization")).toBe(
      "Bearer from-header",
    );
  });

  it("handles a trailing slash and GET without a body", () => {
    const forwarded = withUrlToken(new Request("http://x/api/mcp/tok/"), "tok");
    expect(new URL(forwarded.url).pathname).toBe("/api/mcp");
    expect(forwarded.body).toBeNull();
  });
});
