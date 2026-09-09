"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { profileInputSchema } from "@/lib/validation";
import { DASHBOARD_SECTIONS } from "@/lib/domain";
import { deleteAllData, importData, type ImportReport } from "@/server/services/data";
import { revalidateAll, withValidation } from "./helpers";

export async function updateProfileAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(profileInputSchema, input, async (value, ctx) => {
    const sections = value.dashboardSections
      ? Object.fromEntries(
          Object.entries(value.dashboardSections).filter(([key]) =>
            (DASHBOARD_SECTIONS as readonly string[]).includes(key),
          ),
        )
      : undefined;

    await db
      .update(profiles)
      .set({
        displayName: value.displayName ?? null,
        heightCm: value.heightCm ?? null,
        startingWeightKg: value.startingWeightKg ?? null,
        targetWeightKg: value.targetWeightKg ?? null,
        ...(value.timezone ? { timezone: value.timezone } : {}),
        ...(value.unitSystem ? { unitSystem: value.unitSystem } : {}),
        ...(value.theme ? { theme: value.theme } : {}),
        ...(sections ? { dashboardSections: sections } : {}),
      })
      .where(eq(profiles.userId, ctx.user.id));
    revalidateAll();
    return ok();
  });
}

const sectionsSchema = z.record(z.string(), z.boolean());

export async function updateDashboardSectionsAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return withValidation(sectionsSchema, input, async (value, ctx) => {
    const sections = Object.fromEntries(
      Object.entries(value).filter(([key]) => (DASHBOARD_SECTIONS as readonly string[]).includes(key)),
    );
    await db
      .update(profiles)
      .set({ dashboardSections: { ...(ctx.profile.dashboardSections ?? {}), ...sections } })
      .where(eq(profiles.userId, ctx.user.id));
    revalidateAll();
    return ok();
  });
}

export async function importDataAction(json: string): Promise<ActionResult<ImportReport>> {
  return withValidation(z.string().min(2).max(20_000_000), json, async (value, ctx) => {
    let payload: unknown;
    try {
      payload = JSON.parse(value);
    } catch {
      return fail("That file is not valid JSON");
    }
    try {
      const report = await importData(ctx.user.id, payload);
      revalidateAll();
      return ok(report);
    } catch (error) {
      return fail(
        error instanceof Error ? `Import failed: ${error.message}` : "Import failed",
      );
    }
  });
}

export async function deleteAllDataAction(confirmation: string): Promise<ActionResult<undefined>> {
  return withValidation(z.literal("DELETE"), confirmation, async (_value, ctx) => {
    await deleteAllData(ctx.user.id);
    revalidateAll();
    return ok();
  });
}
