import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { rpgLedger, rpgRewards } from "@/db/schema";
import type { RpgLedgerEntry, RpgReward } from "@/db/schema";
import type { Mission } from "@/lib/rpg/missions";
import { getTrainingSnapshot } from "./training";

/**
 * The parts of the game that are written down: claimed missions and bought
 * rewards. Both go through the ledger, so the gold balance is always a sum
 * of what happened rather than a number that can drift.
 */

export type ClaimResult = { ok: true; mission: Mission } | { ok: false; error: string };

/**
 * Pays a mission out once. Completion is checked against history right now,
 * not trusted from the caller, and the ledger's unique index makes a second
 * claim — a double tap, a retry — a no-op.
 */
export async function claimMission(userId: string, timezone: string, key: string): Promise<ClaimResult> {
  const snapshot = await getTrainingSnapshot(userId, timezone);
  const mission = snapshot.rpg.missions.find((entry) => entry.key === key);
  if (!mission) return { ok: false, error: "That mission is not available right now." };
  if (mission.claimed) return { ok: false, error: `"${mission.title}" was already claimed.` };
  if (!mission.complete) {
    return {
      ok: false,
      error: `"${mission.title}" is not finished yet (${mission.progress}/${mission.target}${mission.unit ? ` ${mission.unit}` : ""}).`,
    };
  }
  const inserted = await db
    .insert(rpgLedger)
    .values({
      userId,
      kind: "mission",
      key: mission.key,
      period: mission.period,
      xp: mission.xp,
      gold: mission.gold,
      label: mission.title,
    })
    .onConflictDoNothing()
    .returning({ id: rpgLedger.id });
  if (inserted.length === 0) return { ok: false, error: `"${mission.title}" was already claimed.` };
  return { ok: true, mission: { ...mission, claimed: true } };
}

export async function goldBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ gold: sql<number>`coalesce(sum(${rpgLedger.gold}), 0)::int` })
    .from(rpgLedger)
    .where(eq(rpgLedger.userId, userId));
  return row?.gold ?? 0;
}

export async function recentLedger(userId: string, limit = 20): Promise<RpgLedgerEntry[]> {
  return db
    .select()
    .from(rpgLedger)
    .where(eq(rpgLedger.userId, userId))
    .orderBy(desc(rpgLedger.createdAt))
    .limit(limit);
}

// --- Rewards ---------------------------------------------------------------

export async function listRewards(userId: string, includeInactive = false): Promise<RpgReward[]> {
  const filters = [eq(rpgRewards.userId, userId)];
  if (!includeInactive) filters.push(eq(rpgRewards.active, true));
  return db
    .select()
    .from(rpgRewards)
    .where(and(...filters))
    .orderBy(asc(rpgRewards.cost), asc(rpgRewards.name));
}

export async function createReward(
  userId: string,
  input: { name: string; cost: number; notes?: string | null },
): Promise<RpgReward> {
  const [created] = await db
    .insert(rpgRewards)
    .values({ userId, name: input.name, cost: input.cost, notes: input.notes ?? null })
    .returning();
  return created;
}

export async function setRewardActive(userId: string, rewardId: string, active: boolean): Promise<boolean> {
  const [updated] = await db
    .update(rpgRewards)
    .set({ active })
    .where(and(eq(rpgRewards.id, rewardId), eq(rpgRewards.userId, userId)))
    .returning({ id: rpgRewards.id });
  return Boolean(updated);
}

export type RedeemResult =
  | { ok: true; reward: RpgReward; balance: number }
  | { ok: false; error: string };

/**
 * Spends gold on a reward. The balance check and the spend happen under one
 * per-user lock, so two quick taps cannot both spend the same gold.
 */
export async function redeemReward(userId: string, rewardId: string): Promise<RedeemResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`rpg:${userId}`}))`);
    const [reward] = await tx
      .select()
      .from(rpgRewards)
      .where(and(eq(rpgRewards.id, rewardId), eq(rpgRewards.userId, userId)))
      .limit(1);
    if (!reward || !reward.active) return { ok: false as const, error: "That reward is not available." };

    const [{ gold }] = await tx
      .select({ gold: sql<number>`coalesce(sum(${rpgLedger.gold}), 0)::int` })
      .from(rpgLedger)
      .where(eq(rpgLedger.userId, userId));
    if (gold < reward.cost) {
      return { ok: false as const, error: `Not enough gold: ${reward.name} costs ${reward.cost}, you have ${gold}.` };
    }
    await tx.insert(rpgLedger).values({
      userId,
      kind: "redeem",
      key: reward.id,
      period: new Date().toISOString(),
      xp: 0,
      gold: -reward.cost,
      label: reward.name,
    });
    return { ok: true as const, reward, balance: gold - reward.cost };
  });
}
