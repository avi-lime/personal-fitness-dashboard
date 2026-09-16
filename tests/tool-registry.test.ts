import { describe, expect, it } from "vitest";
import { TOOLS, toOpenAiTools, toolByName } from "@/mcp/registry";

/**
 * The registry is consumed by two different clients (MCP and the assistant),
 * so its shape is contract, not implementation detail.
 */
describe("tool registry", () => {
  it("exposes the expected tools with unique names", () => {
    expect(TOOLS.length).toBe(17);
    const names = TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    expect(toolByName.get("log_water")?.kind).toBe("write");
    expect(toolByName.get("get_today")?.kind).toBe("read");
  });

  it("marks exactly the destructive tools", () => {
    const destructive = TOOLS.filter((tool) => tool.kind === "destructive").map((t) => t.name);
    expect(destructive).toEqual(["remove_goal"]);
    for (const name of destructive) {
      expect(typeof toolByName.get(name)?.describe).toBe("function");
    }
  });

  it("converts every input schema to an OpenAI function declaration", () => {
    const declarations = toOpenAiTools();
    expect(declarations).toHaveLength(TOOLS.length);
    for (const declaration of declarations) {
      expect(declaration.type).toBe("function");
      expect(declaration.function.description.length).toBeGreaterThan(20);
      expect(declaration.function.parameters.type).toBe("object");
      expect(declaration.function.parameters).not.toHaveProperty("$schema");
    }
    const water = declarations.find((d) => d.function.name === "log_water");
    expect(water?.function.parameters).toMatchObject({ required: ["milliliters"] });
  });
});
