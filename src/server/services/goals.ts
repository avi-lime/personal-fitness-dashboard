import "server-only";
import { and, asc, eq, isNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { goalEntries, goals } from "@/db/schema";
import type { Goal } from "@/db/schema";
import type { EntrySource } from "@/lib/domain";
import { validateMetricParam, type GoalInput, type GoalUpdate } from "@/lib/validation";
import { toLocalDate, type LocalDate } from "@/lib/date";
import { sortGoals, type GoalLike } from "@/lib/goals";
import { getMetric } from "@/lib/metrics";

export function toGoalLike(goal: Goal): GoalLike {
  return {
    id: goal.id,
    name: goal.name,
    description: goal.description,
    type: goal.type,
    unit: goal.unit,
    targetValue: goal.targetValue,
    period: goal.period,
    metricKey: goal.metricKey,
    metricParam: goal.metricParam,
    area: goal.area,
    active: goal.active,
    visibleOnDashboard: goal.visibleOnDashboard,
    showInChecklist: goal.showInChecklist,
    sortOrder: goal.sortOrder,
    color: goal.color,
    icon: goal.icon,
  };
}

/** All non-archived goals for a user, in display order. */
export async function listGoals(userId: string, includeInactive = true): Promise<Goal[]> {
  const rows = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.archivedAt)))
    .orderBy(asc(goals.sortOrder), asc(goals.name));
  return includeInactive ? rows : rows.filter((g) => g.active);
}

export async function getGoal(userId: string, goalId: string): Promise<Goal | null> {
  const row = await db.query.goals.findFirst({
    where: and(eq(goals.id, goalId), eq(goals.userId, userId), isNull(goals.archivedAt)),
  });
  return row ?? null;
}

export async function createGoal(userId: string, input: GoalInput): Promise<Goal> {
  const [{ value: highest } = { value: null }] = await db
    .select({ value: max(goals.sortOrder) })
    .from(goals)
    .where(eq(goals.userId, userId));

  const unit = input.unit ?? (input.metricKey ? getMetric(input.metricKey).defaultUnit : null);

  const [created] = await db
    .insert(goals)
    .values({
      userId,
      name: input.name,
      description: input.description ?? null,
      type: input.type,
      unit,
      targetValue: input.targetValue ?? null,
      period: input.period,
      metricKey: input.metricKey ?? null,
      metricParam: input.metricParam ?? null,
      area: input.area ?? null,
      visibleOnDashboard: input.visibleOnDashboard,
      showInChecklist: input.showInChecklist,
      color: input.color ?? null,
      icon: input.icon ?? null,
      sortOrder: (highest ?? -1) + 1,
    })
    .returning();
  return created;
}

export async function updateGoal(
  userId: string,
  goalId: string,
  patch: GoalUpdate,
): Promise<Goal | null> {
  const changes: Partial<typeof goals.$inferInsert> = {};
  if (patch.name !== undefined) changes.name = patch.name;
  if (patch.description !== undefined) changes.description = patch.description ?? null;
  if (patch.type !== undefined) changes.type = patch.type;
  if (patch.unit !== undefined) changes.unit = patch.unit ?? null;
  if (patch.targetValue !== undefined) changes.targetValue = patch.targetValue ?? null;
  if (patch.period !== undefined) changes.period = patch.period;
  if (patch.metricKey !== undefined) changes.metricKey = patch.metricKey ?? null;
  if (patch.metricParam !== undefined) changes.metricParam = patch.metricParam ?? null;
  if (patch.area !== undefined) changes.area = patch.area ?? null;
  if (patch.visibleOnDashboard !== undefined) changes.visibleOnDashboard = patch.visibleOnDashboard;
  if (patch.showInChecklist !== undefined) changes.showInChecklist = patch.showInChecklist;
  if (patch.color !== undefined) changes.color = patch.color ?? null;
  if (patch.icon !== undefined) changes.icon = patch.icon ?? null;
  if (patch.active !== undefined) changes.active = patch.active;
  if (patch.sortOrder !== undefined) changes.sortOrder = patch.sortOrder;

  if (Object.keys(changes).length === 0) return getGoal(userId, goalId);

  // A partial update is only checkable against the merged goal.
  if (patch.metricKey !== undefined || patch.metricParam !== undefined) {
    const current = await getGoal(userId, goalId);
    if (!current) return null;
    const merged = {
      metricKey: changes.metricKey === undefined ? current.metricKey : changes.metricKey,
      metricParam: changes.metricParam === undefined ? current.metricParam : changes.metricParam,
    };
    const issues: string[] = [];
    validateMetricParam(merged, { addIssue: (issue) => issues.push(issue.message) });
    if (issues.length > 0) throw new Error(issues.join("; "));
  }

  const [updated] = await db
    .update(goals)
    .set(changes)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId), isNull(goals.archivedAt)))
    .returning();
  return updated ?? null;
}

/** Goals are archived, never hard-deleted, so historical entries stay valid. */
export async function archiveGoal(userId: string, goalId: string): Promise<boolean> {
  const [archived] = await db
    .update(goals)
    .set({ archivedAt: new Date(), visibleOnDashboard: false, showInChecklist: false })
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId), isNull(goals.archivedAt)))
    .returning({ id: goals.id });
  return Boolean(archived);
}

export async function reorderGoals(userId: string, orderedIds: string[]): Promise<void> {
  if (orderedIds.length === 0) return;
  await db.transaction(async (tx) => {
    for (const [index, goalId] of orderedIds.entries()) {
      await tx
        .update(goals)
        .set({ sortOrder: index })
        .where(and(eq(goals.id, goalId), eq(goals.userId, userId)));
    }
  });
}

export interface GoalEntryOptions {
  date?: LocalDate | null;
  value?: number | null;
  note?: string | null;
  source?: EntrySource;
  timezone: string;
}

/**
 * Records progress against a goal. For boolean goals the day's entry is
 * replaced rather than accumulated, so "mark done" is idempotent.
 */
export async function recordGoalEntry(
  userId: string,
  goalId: string,
  options: GoalEntryOptions,
): Promise<{ goal: Goal; date: LocalDate; value: number } | null> {
  const goal = await getGoal(userId, goalId);
  if (!goal) return null;

  const date = options.date ?? toLocalDate(new Date(), options.timezone);
  const value = options.value ?? 1;

  if (goal.type === "boolean") {
    await db
      .delete(goalEntries)
      .where(
        and(
          eq(goalEntries.userId, userId),
          eq(goalEntries.goalId, goalId),
          eq(goalEntries.localDate, date),
        ),
      );
  }

  await db.insert(goalEntries).values({
    userId,
    goalId,
    localDate: date,
    value,
    note: options.note ?? null,
    source: options.source ?? "web",
  });

  return { goal, date, value };
}

export async function clearGoalEntries(
  userId: string,
  goalId: string,
  date: LocalDate,
): Promise<void> {
  await db
    .delete(goalEntries)
    .where(
      and(
        eq(goalEntries.userId, userId),
        eq(goalEntries.goalId, goalId),
        eq(goalEntries.localDate, date),
      ),
    );
}

export async function countGoals(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(goals)
    .where(and(eq(goals.userId, userId), isNull(goals.archivedAt)));
  return row?.count ?? 0;
}

export { sortGoals };
