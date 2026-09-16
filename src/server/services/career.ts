import "server-only";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { applications } from "@/db/schema";
import type { Application } from "@/db/schema";
import type { ApplicationStage, EntrySource } from "@/lib/domain";
import type { LocalDate } from "@/lib/date";
import type { ApplicationInput, ApplicationUpdate } from "@/lib/validation";

export interface ListApplicationsOptions {
  stage?: ApplicationStage | null;
  includeArchived?: boolean;
}

/** Pipeline order, then most recently changed first. */
export async function listApplications(
  userId: string,
  options: ListApplicationsOptions = {},
): Promise<Application[]> {
  const filters = [eq(applications.userId, userId)];
  if (!options.includeArchived) filters.push(isNull(applications.archivedAt));
  if (options.stage) filters.push(eq(applications.stage, options.stage));
  return db
    .select()
    .from(applications)
    .where(and(...filters))
    .orderBy(
      sql`case ${applications.stage} when 'offer' then 0 when 'interview' then 1 when 'screening' then 2 when 'applied' then 3 when 'wishlist' then 4 else 5 end`,
      asc(applications.nextStepDate),
      desc(applications.stageChangedAt),
    );
}

export async function getApplication(userId: string, applicationId: string): Promise<Application | null> {
  const row = await db.query.applications.findFirst({
    where: and(eq(applications.id, applicationId), eq(applications.userId, userId)),
  });
  return row ?? null;
}

export async function createApplication(
  userId: string,
  input: ApplicationInput,
  today: LocalDate,
  source: EntrySource = "web",
): Promise<Application> {
  const appliedOn = input.appliedOn ?? (input.stage !== "wishlist" ? today : null);
  const [created] = await db
    .insert(applications)
    .values({
      userId,
      company: input.company,
      role: input.role,
      stage: input.stage,
      url: input.url ?? null,
      location: input.location ?? null,
      salaryNote: input.salaryNote ?? null,
      nextStep: input.nextStep ?? null,
      nextStepDate: input.nextStepDate ?? null,
      appliedOn,
      notes: input.notes ?? null,
      source,
    })
    .returning();
  return created;
}

/**
 * Moving to `applied` (or beyond) stamps `appliedOn` with today when it is
 * still unset, so "applications sent" goals count it on the right day.
 */
export async function updateApplication(
  userId: string,
  applicationId: string,
  patch: ApplicationUpdate,
  today: LocalDate,
): Promise<Application | null> {
  const current = await getApplication(userId, applicationId);
  if (!current) return null;

  const changes: Partial<typeof applications.$inferInsert> = {};
  if (patch.company !== undefined) changes.company = patch.company;
  if (patch.role !== undefined) changes.role = patch.role;
  if (patch.url !== undefined) changes.url = patch.url ?? null;
  if (patch.location !== undefined) changes.location = patch.location ?? null;
  if (patch.salaryNote !== undefined) changes.salaryNote = patch.salaryNote ?? null;
  if (patch.nextStep !== undefined) changes.nextStep = patch.nextStep ?? null;
  if (patch.nextStepDate !== undefined) changes.nextStepDate = patch.nextStepDate ?? null;
  if (patch.appliedOn !== undefined) changes.appliedOn = patch.appliedOn ?? null;
  if (patch.notes !== undefined) changes.notes = patch.notes ?? null;
  if (patch.stage !== undefined && patch.stage !== current.stage) {
    changes.stage = patch.stage;
    changes.stageChangedAt = new Date();
    if (patch.stage !== "wishlist" && current.appliedOn === null && patch.appliedOn === undefined) {
      changes.appliedOn = today;
    }
  }
  if (Object.keys(changes).length === 0) return current;

  const [updated] = await db
    .update(applications)
    .set(changes)
    .where(and(eq(applications.id, applicationId), eq(applications.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function archiveApplication(userId: string, applicationId: string): Promise<boolean> {
  const [archived] = await db
    .update(applications)
    .set({ archivedAt: new Date() })
    .where(
      and(
        eq(applications.id, applicationId),
        eq(applications.userId, userId),
        isNull(applications.archivedAt),
      ),
    )
    .returning({ id: applications.id });
  return Boolean(archived);
}
