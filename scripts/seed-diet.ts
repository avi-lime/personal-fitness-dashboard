/**
 * Creates the initial diet plan for a user, once.
 *
 * Unlike `scripts/seed.ts` this is safe to run against a real deployment: it
 * only ever adds one plan and its meals, and does nothing at all if the user
 * already has a diet plan, so running it twice never duplicates anything.
 *
 * Usage:  npm run db:seed:diet         (local, SEED_USERNAME or "owner")
 *         npm run db:seed:diet:prod    (deployed, PRODUCTION_SEED_USERNAME)
 */
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { seedUsername, targetDatabase } from "./target-database";
import { seedDietPlan } from "./diet-plan-seed";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  const { url, label, production } = targetDatabase(process.argv);
  const username = seedUsername(production);
  console.log(`Seeding the diet plan into ${label} for "${username}"…`);

  // Neon can be cold; the default connect timeout is too eager for it.
  const sql = postgres(url, { max: 1, connect_timeout: 30 });
  const db = drizzle(sql, { schema });

  try {
    const user = await db.query.users.findFirst({ where: eq(schema.users.username, username) });
    if (!user) throw new Error(`No user "${username}". Sign in once, or set SEED_USERNAME.`);

    const created = await seedDietPlan(db, user.id);
    console.log(
      created
        ? `Created diet plan "${created}" for "${username}".`
        : `"${username}" already has a diet plan — nothing to do.`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
