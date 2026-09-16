import { z } from "zod";
import type { McpContext } from "./context";
import { fitnessTools } from "./tools/fitness";

/**
 * The single source of truth for every tool the app exposes.
 *
 * Both consumers iterate this list: the MCP endpoint (`server.ts`) registers
 * each entry with the protocol server, and the in-process assistant
 * (`src/assistant/runner.ts`) hands the same definitions to the model as
 * OpenAI-style function declarations. Adding a tool here is the whole job.
 */
export type ToolKind = "read" | "write" | "destructive";

export interface ToolResult {
  summary: string;
  data: unknown;
}

export interface ToolDefinition<S extends z.ZodObject = z.ZodObject> {
  name: string;
  title: string;
  description: string;
  input: S;
  /** `destructive` tools are never executed by the assistant without confirmation. */
  kind: ToolKind;
  run(ctx: McpContext, args: z.output<S>): Promise<ToolResult>;
  /** Human sentence for the confirmation prompt of a destructive tool. */
  describe?(ctx: McpContext, args: z.output<S>): Promise<string>;
}

/** Erases the schema generic so heterogeneous tools can share one list. */
export type AnyTool = ToolDefinition<z.ZodObject>;

export function defineTool<S extends z.ZodObject>(tool: ToolDefinition<S>): AnyTool {
  return tool as AnyTool;
}

export const TOOLS: readonly AnyTool[] = [...fitnessTools];

export const toolByName: ReadonlyMap<string, AnyTool> = new Map(
  TOOLS.map((tool) => [tool.name, tool]),
);

/** OpenAI / Gemini-compatible function declarations for a set of tools. */
export interface FunctionDeclaration {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function toOpenAiTools(tools: readonly AnyTool[] = TOOLS): FunctionDeclaration[] {
  return tools.map((tool) => {
    const parameters = z.toJSONSchema(tool.input, { io: "input" }) as Record<string, unknown>;
    delete parameters.$schema;
    return {
      type: "function",
      function: { name: tool.name, description: tool.description, parameters },
    };
  });
}
