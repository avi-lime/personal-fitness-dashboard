import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import type { Profile } from "@/db/schema";
import { getEnv } from "@/lib/env";

export interface OwnerUser {
  id: string;
  username: string;
}

/**
 * The deployment owns exactly one account, named by AUTH_USERNAME. The row is
 * created on demand so a fresh database needs no manual setup step. All data
 * is scoped by this user id, which keeps the queries multi-user-safe by
 * construction.
 *
 * Lives here (not in `server/auth.ts`) so scripts and the assistant can use it
 * without pulling in Next's request helpers.
 */
export async function ensureOwnerUser(): Promise<OwnerUser> {
  const { AUTH_USERNAME } = getEnv();
  const existing = await db.query.users.findFirst({ where: eq(users.username, AUTH_USERNAME) });
  if (existing) return { id: existing.id, username: existing.username };

  const [created] = await db
    .insert(users)
    .values({ username: AUTH_USERNAME })
    .onConflictDoNothing()
    .returning();
  if (created) {
    await db.insert(profiles).values({ userId: created.id }).onConflictDoNothing();
    return { id: created.id, username: created.username };
  }
  const raced = await db.query.users.findFirst({ where: eq(users.username, AUTH_USERNAME) });
  if (!raced) throw new Error("Failed to create the owner account");
  return { id: raced.id, username: raced.username };
}

export async function getProfileFor(userId: string): Promise<Profile> {
  const existing = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  if (existing) return existing;
  const [created] = await db.insert(profiles).values({ userId }).returning();
  return created;
}
