/**
 * Turns thrown values into something a person can act on.
 *
 * Driver-level connection failures deserve special handling: `postgres.js`
 * raises them with a `code` but an empty `message`, which would otherwise
 * surface in the UI as a blank "something went wrong".
 */
const CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ECONNRESET",
  "CONNECTION_CLOSED",
  "CONNECT_TIMEOUT",
]);

export const DATABASE_UNREACHABLE =
  "Cannot reach the database. Check that it is running and that DATABASE_URL is correct — locally, `npm run db:up` starts it.";

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = (error as { code: unknown }).code;
  return typeof code === "string" ? code : null;
}

/** The error, then its `cause` chain — Drizzle wraps driver errors in "Failed query: …". */
function chain(error: unknown): unknown[] {
  const seen: unknown[] = [];
  let current = error;
  while (current && typeof current === "object" && seen.length < 10 && !seen.includes(current)) {
    seen.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return seen;
}

export function isDatabaseUnreachable(error: unknown): boolean {
  return chain(error).some((link) => {
    const code = errorCode(link);
    return code !== null && CONNECTION_CODES.has(code);
  });
}

export function describeError(error: unknown, fallback = "Something went wrong"): string {
  if (isDatabaseUnreachable(error)) return DATABASE_UNREACHABLE;
  if (error instanceof Error && error.message.trim() !== "") return error.message;
  const code = errorCode(error);
  return code ? `${fallback} (${code})` : fallback;
}

/**
 * Rethrows a database outage as a self-explanatory error.
 *
 * React strips `cause` when an error crosses to a client error boundary, so a
 * connection failure has to be identified on the server while the driver's
 * `code` is still attached.
 */
export function rethrowExplained(error: unknown): never {
  if (isDatabaseUnreachable(error)) throw new Error(DATABASE_UNREACHABLE, { cause: error });
  throw error;
}
