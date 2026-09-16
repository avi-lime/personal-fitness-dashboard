import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * The client is created on first use, never at module load.
 *
 * `next build` imports every route module to collect page data, so eager
 * construction would read (and validate) DATABASE_URL at build time and fail a
 * deployment that is otherwise configured correctly. Building must not require
 * a database; connecting is a request-time concern.
 *
 * A single pooled client is reused per process. `max: 1` keeps serverless
 * invocations from exhausting connection slots, and `prepare: false` is
 * required by transaction-mode poolers such as pgBouncer (Neon, Supabase).
 *
 * Only the *connection pool* is cached globally. The Drizzle wrapper is cheap
 * and is rebuilt per module instance so that, under dev hot reload, it always
 * carries the current `schema` (a cached wrapper kept an outdated table list).
 */
const globalForDb = globalThis as unknown as {
  __lifeDashboardSql?: ReturnType<typeof postgres>;
};

let instance: Database | null = null;

function client(): ReturnType<typeof postgres> {
  if (globalForDb.__lifeDashboardSql) return globalForDb.__lifeDashboardSql;
  const created = postgres(getEnv().DATABASE_URL, {
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    prepare: false,
  });
  globalForDb.__lifeDashboardSql = created;
  return created;
}

function resolve(): Database {
  if (!instance) instance = drizzle(client(), { schema });
  return instance;
}

/** Behaves exactly like a Drizzle instance; connects on the first property access. */
export const db: Database = new Proxy({} as Database, {
  get(_target, property) {
    const instance = resolve();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  has(_target, property) {
    return Reflect.has(resolve(), property);
  },
});

export { schema };
