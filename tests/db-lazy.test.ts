import { describe, expect, it, vi } from "vitest";

/**
 * `next build` imports every route module to collect page data. If the database
 * client were built at module load, a deployment would fail before it ever
 * served a request — which is exactly what happened once. Importing the module
 * must stay free of any environment read or connection attempt.
 */
describe("database module", () => {
  it("imports without DATABASE_URL present", async () => {
    vi.resetModules();
    const saved = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      const imported = await import("@/db");
      expect(imported.db).toBeDefined();
    } finally {
      if (saved === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = saved;
      vi.resetModules();
    }
  });

  it("still exposes the Drizzle query API once resolved", async () => {
    const { db } = await import("@/db");
    expect(typeof db.select).toBe("function");
    expect(typeof db.transaction).toBe("function");
    expect(db.query.users).toBeDefined();
  });
});
