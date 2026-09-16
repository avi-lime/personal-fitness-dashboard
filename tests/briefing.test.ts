import { describe, expect, it } from "vitest";
import { validateAction } from "@/assistant/briefing";

describe("briefing actions", () => {
  it("keeps whitelisted, well-formed actions", () => {
    expect(validateAction({ tool: "log_water", args: { milliliters: 500 } })).toEqual({
      tool: "log_water",
      args: { milliliters: 500 },
      label: "Log water",
    });
    expect(validateAction({ tool: "plan_day", args: {} })?.tool).toBe("plan_day");
  });

  it("drops destructive, unknown and malformed actions", () => {
    expect(validateAction({ tool: "remove_goal", args: { goalId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" } })).toBeNull();
    expect(validateAction({ tool: "log_food", args: { foodName: "x", calories: 1 } })).toBeNull();
    expect(validateAction({ tool: "log_water", args: { milliliters: -1 } })).toBeNull();
    expect(validateAction({ tool: "nope", args: {} })).toBeNull();
    expect(validateAction(null)).toBeNull();
  });
});
