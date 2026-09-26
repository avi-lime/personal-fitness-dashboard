/**
 * Which database a script should talk to.
 *
 * Local by default. `--production` switches to `PRODUCTION_DATABASE_URL` from
 * `.env.local`, so hitting the deployed database is always an explicit choice
 * at the call site and the URL never has to be pasted onto a command line.
 */
export function targetDatabase(argv: string[]): {
  url: string;
  label: string;
  production: boolean;
} {
  const production = argv.includes("--production");
  const key = production ? "PRODUCTION_DATABASE_URL" : "DATABASE_URL";
  const url = process.env[key];
  if (!url) throw new Error(`${key} is not set`);
  return { url, label: production ? `production (${new URL(url).host})` : "local", production };
}

/**
 * Whose data to seed. The deployed database has its own account name, so it
 * gets its own setting rather than an environment variable typed at the shell
 * — the command stays a fixed string, and a local run can never be pointed at
 * the production account by a leftover export.
 */
export function seedUsername(production: boolean): string {
  if (production) {
    const name = process.env.PRODUCTION_SEED_USERNAME;
    if (!name) throw new Error("PRODUCTION_SEED_USERNAME is not set in .env.local");
    return name;
  }
  return process.env.SEED_USERNAME ?? process.env.AUTH_USERNAME ?? "owner";
}
