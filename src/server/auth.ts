import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";
import { getEnv } from "@/lib/env";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/session";
import { DEFAULT_DASHBOARD_SECTIONS, type DashboardSectionVisibility } from "@/lib/domain";
import { rethrowExplained } from "@/lib/errors";
import type { Profile } from "@/db/schema";

export interface AuthUser {
  id: string;
  username: string;
}

/** Constant-time string comparison that tolerates differing lengths. */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    // Still compare something of equal length so timing does not leak length.
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function verifyCredentials(username: string, password: string): boolean {
  const env = getEnv();
  const userOk = safeEqual(username, env.AUTH_USERNAME);
  const passOk = safeEqual(password, env.AUTH_PASSWORD);
  return userOk && passOk;
}

/**
 * The deployment owns exactly one account, named by AUTH_USERNAME. The row is
 * created on demand so a fresh database needs no manual setup step. All data is
 * scoped by this user id, which keeps the queries multi-user-safe by
 * construction.
 */
export async function ensureOwnerUser(): Promise<AuthUser> {
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

export async function startSession(user: AuthUser): Promise<void> {
  const token = await createSessionToken({ sub: user.id, username: user.username });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Every authenticated request reaches the database here first, so this is
  // where an outage is turned into a message that says what to do about it.
  try {
    const user = await db.query.users.findFirst({ where: eq(users.id, payload.sub) });
    if (!user || user.username !== getEnv().AUTH_USERNAME) return null;
    return { id: user.id, username: user.username };
  } catch (error) {
    rethrowExplained(error);
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export interface RequestContext {
  user: AuthUser;
  profile: Profile;
  timezone: string;
  sections: DashboardSectionVisibility;
}

export async function getProfileFor(userId: string): Promise<Profile> {
  try {
    const existing = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
    if (existing) return existing;
    const [created] = await db.insert(profiles).values({ userId }).returning();
    return created;
  } catch (error) {
    rethrowExplained(error);
  }
}

/** The context every authenticated page and server action starts from. */
export async function requireContext(): Promise<RequestContext> {
  const user = await requireUser();
  const profile = await getProfileFor(user.id);
  return {
    user,
    profile,
    timezone: profile.timezone,
    sections: { ...DEFAULT_DASHBOARD_SECTIONS, ...(profile.dashboardSections ?? {}) },
  };
}
