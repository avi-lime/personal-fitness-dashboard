import "server-only";
import { defineTool } from "../registry";
import { recordMutation } from "../audit";
import { ToolFailure } from "./write";
import * as schemas from "../schemas";
import { logTimeEntry, startTimer, stopTimer } from "@/server/services/time";
import { AREA_LABELS } from "@/lib/domain";
import { formatDuration } from "@/lib/format";
import type { TimeEntry } from "@/db/schema";

function view(entry: TimeEntry) {
  return {
    id: entry.id,
    category: entry.category,
    label: entry.label,
    startAt: entry.startAt.toISOString(),
    endAt: entry.endAt?.toISOString() ?? null,
    durationMinutes: entry.durationMinutes,
    date: entry.localDate,
    running: entry.endAt === null,
  };
}

export const timeTools = [
  defineTool({
    name: "start_timer",
    title: "Start timer",
    kind: "write",
    input: schemas.startTimerInput,
    description:
      "Starts tracking time under a category (study, freelance, work, career…). Any timer already running is stopped first. Time counts towards 'time tracked' goals once the timer stops.",
    async run(ctx, args) {
      const { started, stopped } = await startTimer(
        ctx.userId,
        ctx.timezone,
        args.category,
        args.label ?? null,
        ctx.source,
      );
      const label = started.label ? ` (${started.label})` : "";
      const previous = stopped
        ? ` Stopped the ${AREA_LABELS[stopped.category].toLowerCase()} timer at ${formatDuration((stopped.durationMinutes ?? 0) / 60)}.`
        : "";
      const summary = `Started a ${AREA_LABELS[args.category].toLowerCase()} timer${label}.${previous}`;
      await recordMutation(ctx.userId, "start_timer", args, summary, ctx.source);
      return { summary, data: { started: view(started), stopped: stopped ? view(stopped) : null } };
    },
  }),
  defineTool({
    name: "stop_timer",
    title: "Stop timer",
    kind: "write",
    input: schemas.stopTimerInput,
    description: "Stops the running timer and records the session. Errors if nothing is running.",
    async run(ctx, args) {
      const stopped = await stopTimer(ctx.userId, args.notes ?? null);
      if (!stopped) throw new ToolFailure("No timer is running.");
      const summary = `Stopped the ${AREA_LABELS[stopped.category].toLowerCase()} timer after ${formatDuration((stopped.durationMinutes ?? 0) / 60)}.`;
      await recordMutation(ctx.userId, "stop_timer", args, summary, ctx.source);
      return { summary, data: view(stopped) };
    },
  }),
  defineTool({
    name: "log_time",
    title: "Log time",
    kind: "write",
    input: schemas.logTimeInput,
    description:
      "Records a finished session of N minutes under a category, ending now (or on the given day). Use when the user says they already spent time on something.",
    async run(ctx, args) {
      const entry = await logTimeEntry(
        ctx.userId,
        ctx.timezone,
        { ...args, label: args.label ?? null, date: args.date ?? null, notes: args.notes ?? null },
        ctx.source,
      );
      const summary = `Logged ${formatDuration(args.minutes / 60)} of ${AREA_LABELS[args.category].toLowerCase()}${entry.label ? ` (${entry.label})` : ""} on ${entry.localDate}.`;
      await recordMutation(ctx.userId, "log_time", args, summary, ctx.source);
      return { summary, data: view(entry) };
    },
  }),
];
