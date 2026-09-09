import { describe, expect, it } from "vitest";
import { DATABASE_UNREACHABLE, describeError, isDatabaseUnreachable } from "@/lib/errors";

describe("error descriptions", () => {
  it("recognises driver connection failures", () => {
    // postgres.js raises these with a code but an empty message.
    const connectionError = Object.assign(new Error(""), { code: "ECONNREFUSED" });
    expect(isDatabaseUnreachable(connectionError)).toBe(true);
    expect(describeError(connectionError)).toBe(DATABASE_UNREACHABLE);
    expect(describeError({ code: "ENOTFOUND" })).toBe(DATABASE_UNREACHABLE);
  });

  it("passes through a real message", () => {
    expect(describeError(new Error("Goal not found"))).toBe("Goal not found");
  });

  it("never returns an empty string", () => {
    expect(describeError(new Error(""))).toBe("Something went wrong");
    expect(describeError(undefined)).toBe("Something went wrong");
    expect(describeError(new Error("   "), "Could not load")).toBe("Could not load");
  });

  it("includes an unknown code for context", () => {
    expect(describeError(Object.assign(new Error(""), { code: "42P01" }))).toBe(
      "Something went wrong (42P01)",
    );
  });
});

describe("wrapped driver errors", () => {
  it("finds a connection failure inside Drizzle's query wrapper", () => {
    // Drizzle rethrows as `Failed query: …` with the driver error as `cause`.
    const driverError = Object.assign(new Error(""), { code: "ECONNREFUSED" });
    const wrapped = new Error('Failed query: select "id" from "users"', { cause: driverError });
    expect(isDatabaseUnreachable(wrapped)).toBe(true);
    expect(describeError(wrapped)).toBe(DATABASE_UNREACHABLE);
  });

  it("does not mistake an ordinary query error for an outage", () => {
    const wrapped = new Error("Failed query: bad column", {
      cause: Object.assign(new Error('column "x" does not exist'), { code: "42703" }),
    });
    expect(isDatabaseUnreachable(wrapped)).toBe(false);
    expect(describeError(wrapped)).toBe("Failed query: bad column");
  });

  it("survives a self-referencing cause chain", () => {
    const loop: Error & { cause?: unknown } = new Error("loop");
    loop.cause = loop;
    expect(isDatabaseUnreachable(loop)).toBe(false);
  });
});
