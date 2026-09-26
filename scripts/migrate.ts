/**
 * Applies pending SQL migrations from ./drizzle.
 * Usage: npm run db:migrate          (local)
 *        npm run db:migrate:prod     (the deployed database)
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { targetDatabase } from "./target-database";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  const { url, label } = targetDatabase(process.argv);
  console.log(`Migrating ${label}…`);
  const sql = postgres(url, { max: 1 });
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  await sql.end();
  console.log("Migrations applied.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
