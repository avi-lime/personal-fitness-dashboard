import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { verifyCredentials } from "@/server/auth";

describe("personal authentication", () => {
  it("accepts only the configured credentials", () => {
    const username = process.env.AUTH_USERNAME as string;
    const password = process.env.AUTH_PASSWORD as string;
    expect(verifyCredentials(username, password)).toBe(true);
    expect(verifyCredentials(username, `${password}x`)).toBe(false);
    expect(verifyCredentials(username, password.slice(0, -1))).toBe(false);
    expect(verifyCredentials("someone-else", password)).toBe(false);
    expect(verifyCredentials("", "")).toBe(false);
  });

  it("round-trips a signed session token", async () => {
    const token = await createSessionToken({ sub: "user-1", username: "owner" });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ sub: "user-1", username: "owner" });
  });

  it("rejects a tampered or unsigned token", async () => {
    const token = await createSessionToken({ sub: "user-1", username: "owner" });
    expect(await verifySessionToken(`${token}x`)).toBeNull();
    expect(await verifySessionToken("not.a.token")).toBeNull();
    // A token signed with a different key must not validate.
    const [header, body] = token.split(".");
    expect(await verifySessionToken(`${header}.${body}.aaaa`)).toBeNull();
  });
});
