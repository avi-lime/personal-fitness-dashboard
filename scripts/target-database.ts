/**
 * Which database a script should talk to.
 *
 * Local by default. `--production` switches to `PRODUCTION_DATABASE_URL` from
 * `.env.local`, so hitting the deployed database is always an explicit choice
 * at the call site and the URL never has to be pasted onto a command line.
 */
export function targetDatabase(argv: string[]): { url: string; label: string } {
  const production = argv.includes("--production");
  const key = production ? "PRODUCTION_DATABASE_URL" : "DATABASE_URL";
  const url = process.env[key];
  if (!url) throw new Error(`${key} is not set`);
  return { url, label: production ? `production (${new URL(url).host})` : "local" };
}
