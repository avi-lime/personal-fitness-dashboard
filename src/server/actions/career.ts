"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { applicationInputSchema, applicationUpdateSchema, uuidSchema } from "@/lib/validation";
import { toLocalDate } from "@/lib/date";
import {
  archiveApplication,
  createApplication,
  updateApplication,
} from "@/server/services/career";
import { revalidateAll, withValidation } from "./helpers";

export async function createApplicationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return withValidation(applicationInputSchema, input, async (value, ctx) => {
    const app = await createApplication(ctx.user.id, value, toLocalDate(new Date(), ctx.timezone));
    revalidateAll();
    return ok({ id: app.id });
  });
}

const updateSchema = z.object({ applicationId: uuidSchema, patch: applicationUpdateSchema });

export async function updateApplicationAction(input: unknown): Promise<ActionResult<undefined>> {
  return withValidation(updateSchema, input, async (value, ctx) => {
    const updated = await updateApplication(
      ctx.user.id,
      value.applicationId,
      value.patch,
      toLocalDate(new Date(), ctx.timezone),
    );
    if (!updated) return fail("Application not found");
    revalidateAll();
    return ok();
  });
}

export async function archiveApplicationAction(applicationId: string): Promise<ActionResult<undefined>> {
  return withValidation(uuidSchema, applicationId, async (id, ctx) => {
    const archived = await archiveApplication(ctx.user.id, id);
    if (!archived) return fail("Application not found");
    revalidateAll();
    return ok();
  });
}
