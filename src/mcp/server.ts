import "server-only";
import type { McpServer, ServerContext, ToolAnnotations } from "@modelcontextprotocol/server";
import { McpAuthError, resolveContext } from "./context";
import { TOOLS, type AnyTool, type ToolKind } from "./registry";
import { toolError, toolResult } from "./response";
import { ToolFailure } from "./tools/write";

const ANNOTATIONS: Record<ToolKind, ToolAnnotations> = {
  read: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  write: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  destructive: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
};

/**
 * Runs a tool body with the authenticated context, converting expected failures
 * into tool errors instead of transport errors.
 */
async function execute(tool: AnyTool, args: unknown, ctx: ServerContext) {
  try {
    const mcpContext = await resolveContext(ctx.http?.authInfo);
    const { summary, data } = await tool.run(mcpContext, args as Record<string, unknown>);
    return toolResult(summary, data);
  } catch (error) {
    if (error instanceof McpAuthError) return toolError(error.message);
    if (error instanceof ToolFailure) return toolError(error.message);
    return toolError(
      error instanceof Error ? `Request failed: ${error.message}` : "Request failed.",
    );
  }
}

/** Registers every tool in the registry. This is the entire MCP surface — nothing generic. */
export function registerTools(server: McpServer): void {
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: ANNOTATIONS[tool.kind],
      },
      (args, ctx) => execute(tool, args, ctx),
    );
  }
}
