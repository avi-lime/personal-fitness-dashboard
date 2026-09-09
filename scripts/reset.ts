/**
 * DEVELOPMENT-ONLY: drops every table and re-applies migrations.
 * Usage: npm run db:reset
 */
import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to reset a production database.");
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  await sql`drop schema if exists public cascade`;
  await sql`create schema public`;
  await sql`drop schema if exists drizzle cascade`;
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();
  console.log("Database reset and migrated.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
