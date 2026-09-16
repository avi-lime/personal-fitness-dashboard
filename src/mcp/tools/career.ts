import "server-only";
import { defineTool } from "../registry";
import { recordMutation } from "../audit";
import { ToolFailure } from "./write";
import { findOneByName } from "./match";
import * as schemas from "../schemas";
import {
  archiveApplication,
  createApplication,
  getApplication,
  listApplications,
  updateApplication,
} from "@/server/services/career";
import { APPLICATION_STAGE_LABELS, APPLICATION_STAGES } from "@/lib/domain";
import type { Application } from "@/db/schema";
import type { McpContext } from "../context";

function view(app: Application) {
  return {
    id: app.id,
    company: app.company,
    role: app.role,
    stage: app.stage,
    url: app.url,
    location: app.location,
    salaryNote: app.salaryNote,
    nextStep: app.nextStep,
    nextStepDate: app.nextStepDate,
    appliedOn: app.appliedOn,
    notes: app.notes,
    archived: app.archivedAt !== null,
  };
}

async function resolveApplication(ctx: McpContext, id?: string, company?: string): Promise<Application> {
  if (id) {
    const app = await getApplication(ctx.userId, id);
    if (!app) throw new ToolFailure(`No application found with id ${id}.`);
    return app;
  }
  const open = await listApplications(ctx.userId);
  return findOneByName(open, company ?? "", (app) => `${app.company} ${app.role}`, "application");
}

export const careerTools = [
  defineTool({
    name: "add_application",
    title: "Add job application",
    kind: "write",
    input: schemas.addApplicationInput,
    description:
      "Adds a job application to the pipeline. Stage defaults to wishlist; any later stage stamps appliedOn with today unless given. Use update_application to move it through stages.",
    async run(ctx, args) {
      const app = await createApplication(
        ctx.userId,
        { ...args, stage: args.stage ?? "wishlist" },
        ctx.today,
        ctx.source,
      );
      const summary = `Added ${app.role} at ${app.company} (${APPLICATION_STAGE_LABELS[app.stage].toLowerCase()}).`;
      await recordMutation(ctx.userId, "add_application", args, summary, ctx.source);
      return { summary, data: view(app) };
    },
  }),
  defineTool({
    name: "update_application",
    title: "Update job application",
    kind: "write",
    input: schemas.updateApplicationInput,
    description:
      "Moves an application to a new stage and/or updates its next step, dates, url or notes. Identify it by applicationId or by company name (matched loosely among active applications).",
    async run(ctx, args) {
      const { applicationId, company, ...patch } = args;
      const app = await resolveApplication(ctx, applicationId, company);
      const updated = await updateApplication(ctx.userId, app.id, patch, ctx.today);
      if (!updated) throw new ToolFailure(`No application found with id ${app.id}.`);
      const changed = Object.keys(patch).filter((key) => patch[key as keyof typeof patch] !== undefined);
      const summary =
        patch.stage && patch.stage !== app.stage
          ? `Moved ${updated.role} at ${updated.company} to ${APPLICATION_STAGE_LABELS[updated.stage].toLowerCase()}.`
          : changed.length === 0
            ? `No changes requested for ${updated.company}.`
            : `Updated ${changed.join(", ")} for ${updated.role} at ${updated.company}.`;
      await recordMutation(ctx.userId, "update_application", args, summary, ctx.source);
      return { summary, data: view(updated) };
    },
  }),
  defineTool({
    name: "list_applications",
    title: "List job applications",
    kind: "read",
    input: schemas.listApplicationsInput,
    description:
      "Active job applications, ordered by pipeline stage (offers first), with next steps and their dates. Filter by stage; archived ones are hidden unless asked.",
    async run(ctx, args) {
      const rows = await listApplications(ctx.userId, {
        stage: args.stage ?? null,
        includeArchived: args.includeArchived ?? false,
      });
      const counts = APPLICATION_STAGES.map(
        (stage) => `${rows.filter((app) => app.stage === stage).length} ${stage}`,
      )
        .filter((entry) => !entry.startsWith("0 "))
        .join(", ");
      return {
        summary: rows.length === 0 ? "No applications yet." : `${rows.length} application(s): ${counts}.`,
        data: { today: ctx.today, applications: rows.map(view) },
      };
    },
  }),
  defineTool({
    name: "archive_application",
    title: "Archive job application",
    kind: "destructive",
    input: schemas.archiveApplicationInput,
    description:
      "Hides an application from the pipeline (kept for history). Use for withdrawn or long-dead applications; set stage rejected instead when they said no. Confirm with the user first.",
    async describe(ctx, args) {
      const app = await resolveApplication(ctx, args.applicationId, args.company);
      return `Archive the application for ${app.role} at ${app.company}?`;
    },
    async run(ctx, args) {
      const app = await resolveApplication(ctx, args.applicationId, args.company);
      await archiveApplication(ctx.userId, app.id);
      const summary = `Archived ${app.role} at ${app.company}.`;
      await recordMutation(ctx.userId, "archive_application", args, summary, ctx.source);
      return { summary, data: { id: app.id, archived: true } };
    },
  }),
];
