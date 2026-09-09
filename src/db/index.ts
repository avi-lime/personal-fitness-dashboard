import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * A single pooled client per process. `max: 1` keeps serverless invocations
 * from exhausting the database's connection slots; a pooled DATABASE_URL
 * (Neon/Supabase pooler) is recommended in production.
 */
const globalForDb = globalThis as unknown as {
  __lifeDashboardSql?: ReturnType<typeof postgres>;
};

function createClient() {
  const { DATABASE_URL } = getEnv();
  return postgres(DATABASE_URL, {
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    prepare: false,
  });
}

const client = globalForDb.__lifeDashboardSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.__lifeDashboardSql = client;

export const db = drizzle(client, { schema });
export type Database = typeof db;
export { schema };
