import { describe, expect, it } from "vitest";
import { HUBS, NAV_ITEMS, hubFor, hubPageFor, isActivePath } from "@/components/layout/nav-items";

describe("hub navigation", () => {
  it("puts every page in exactly one place", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs).toEqual(expect.arrayContaining(["/", "/training", "/food", "/diet", "/plan", "/money", "/career"]));
  });

  it("finds the hub for a page and for anything nested under it", () => {
    expect(hubFor("/")?.key).toBe("today");
    expect(hubFor("/food")?.key).toBe("health");
    expect(hubFor("/training/session/abc")?.key).toBe("health");
    expect(hubFor("/tasks")?.key).toBe("day");
    expect(hubFor("/career")).toBeNull();
    expect(hubFor("/settings")).toBeNull();
  });

  it("matches whole path segments, not prefixes", () => {
    expect(isActivePath("/timeline", "/time")).toBe(false);
    expect(isActivePath("/time", "/time")).toBe(true);
    expect(isActivePath("/training/abc", "/training")).toBe(true);
    expect(isActivePath("/food", "/")).toBe(false);
  });

  it("remembers the hub page, not the deep path inside it", () => {
    const health = HUBS.find((hub) => hub.key === "health")!;
    expect(hubPageFor(health, "/training/session/abc")?.href).toBe("/training");
    expect(hubPageFor(health, "/money")).toBeNull();
  });
});
