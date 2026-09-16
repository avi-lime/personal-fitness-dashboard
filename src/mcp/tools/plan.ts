import "server-only";
import { defineTool } from "../registry";
import { recordMutation } from "../audit";
import { ToolFailure } from "./write";
import { findOneByName } from "./match";
import * as schemas from "../schemas";
import {
  addBlock,
  createRoutine,
  deleteRoutine,
  listBlocks,
  listRoutines,
  planDay,
  setBlockDone,
} from "@/server/services/plan";
import { listTasks } from "@/server/services/tasks";
import { toLocalTime } from "@/lib/date";
import { currentBlock, maskToWeekdays, nextBlock, routineAppliesOn } from "@/lib/plan";
import type { Routine, TimeBlock } from "@/db/schema";
import type { McpContext } from "../context";

function blockView(block: TimeBlock) {
  return {
    id: block.id,
    startTime: block.startTime,
    endTime: block.endTime,
    label: block.label,
    kind: block.kind,
    area: block.area,
    taskId: block.taskId,
    done: block.done,
  };
}

function routineView(routine: Routine) {
  return {
    id: routine.id,
    label: routine.label,
    kind: routine.kind,
    area: routine.area,
    startTime: routine.startTime,
    endTime: routine.endTime,
    weekdays: maskToWeekdays(routine.weekdays),
    active: routine.active,
  };
}

async function resolveBlock(ctx: McpContext, date: string, id?: string, label?: string): Promise<TimeBlock> {
  const blocks = await listBlocks(ctx.userId, date);
  if (id) {
    const block = blocks.find((entry) => entry.id === id);
    if (!block) throw new ToolFailure(`No block with id ${id} on ${date}.`);
    return block;
  }
  return findOneByName(blocks, label ?? "", (block) => block.label, `block on ${date}`);
}

export const planTools = [
  defineTool({
    name: "get_day_plan",
    title: "Get day plan",
    kind: "read",
    input: schemas.getDayPlanInput,
    description:
      "The planned blocks for a day (with the current and next block when it is today), the routines that apply that weekday, and tasks due by then. Defaults to today.",
    async run(ctx, args) {
      const date = args.date ?? ctx.today;
      const [blocks, routines, tasks] = await Promise.all([
        listBlocks(ctx.userId, date),
        listRoutines(ctx.userId, true),
        listTasks(ctx.userId, { status: "todo", dueBefore: date, limit: 30 }),
      ]);
      const now = date === ctx.today ? toLocalTime(new Date(), ctx.timezone) : null;
      const current = now ? currentBlock(blocks, now) : null;
      const upcoming = now ? nextBlock(blocks, now) : null;
      const summary =
        blocks.length === 0
          ? `Nothing planned for ${date} yet.`
          : `${blocks.length} block(s) on ${date}.${current ? ` Now: ${current.label} until ${current.endTime}.` : ""}${upcoming ? ` Next: ${upcoming.label} at ${upcoming.startTime}.` : ""}`;
      return {
        summary,
        data: {
          date,
          now,
          blocks: blocks.map(blockView),
          current: current ? blockView(current) : null,
          next: upcoming ? blockView(upcoming) : null,
          routinesToday: routines.filter((r) => routineAppliesOn(r.weekdays, date)).map(routineView),
          tasksDue: tasks.filter((task) => task.dueDate !== null).map((task) => ({
            id: task.id,
            title: task.title,
            dueDate: task.dueDate,
            priority: task.priority,
          })),
        },
      };
    },
  }),
  defineTool({
    name: "plan_day",
    title: "Plan the day",
    kind: "write",
    input: schemas.planDayInput,
    description:
      "Builds the day's plan from the user's routines (idempotent — safe to call again after adding routines). Returns the blocks and the tasks due, so you can offer add_block for anything else the user wants scheduled.",
    async run(ctx, args) {
      const date = args.date ?? ctx.today;
      const { blocks, added } = await planDay(ctx.userId, date, ctx.source);
      const tasks = await listTasks(ctx.userId, { status: "todo", dueBefore: date, limit: 20 });
      const summary =
        added === 0 && blocks.length === 0
          ? `No routines apply on ${date}; add blocks or routines to plan it.`
          : `Planned ${date}: ${added} routine block(s) added, ${blocks.length} in total.`;
      await recordMutation(ctx.userId, "plan_day", args, summary, ctx.source);
      return {
        summary,
        data: {
          date,
          blocks: blocks.map(blockView),
          tasksDue: tasks.map((task) => ({ id: task.id, title: task.title, dueDate: task.dueDate })),
        },
      };
    },
  }),
  defineTool({
    name: "add_block",
    title: "Add block to the plan",
    kind: "write",
    input: schemas.addBlockInput,
    description:
      "Schedules one block on a day: start and end as HH:MM, a label, optionally a kind, area or the task it is for. Defaults to today.",
    async run(ctx, args) {
      const date = args.date ?? ctx.today;
      const block = await addBlock(
        ctx.userId,
        date,
        { ...args, kind: args.kind ?? "other", area: args.area ?? null, taskId: args.taskId ?? null, date },
        ctx.source,
      );
      const summary = `Planned "${block.label}" ${block.startTime}–${block.endTime} on ${date}.`;
      await recordMutation(ctx.userId, "add_block", args, summary, ctx.source);
      return { summary, data: blockView(block) };
    },
  }),
  defineTool({
    name: "complete_block",
    title: "Complete a planned block",
    kind: "write",
    input: schemas.completeBlockInput,
    description:
      "Marks a planned block done (or not done with done:false). Identify it by blockId or by its label, matched loosely among that day's blocks. Defaults to today.",
    async run(ctx, args) {
      const date = args.date ?? ctx.today;
      const block = await resolveBlock(ctx, date, args.blockId, args.label);
      const done = args.done ?? true;
      const updated = await setBlockDone(ctx.userId, block.id, done);
      if (!updated) throw new ToolFailure(`No block with id ${block.id}.`);
      const summary = `${done ? "Completed" : "Reopened"} "${updated.label}" on ${date}.`;
      await recordMutation(ctx.userId, "complete_block", args, summary, ctx.source);
      return { summary, data: blockView(updated) };
    },
  }),
  defineTool({
    name: "add_routine",
    title: "Add routine",
    kind: "write",
    input: schemas.addRoutineInput,
    description:
      "Creates a recurring block (e.g. gym 07:00–08:00 on mon/wed/fri). Routines become blocks when the day is planned with plan_day.",
    async run(ctx, args) {
      const routine = await createRoutine(ctx.userId, {
        ...args,
        kind: args.kind ?? "routine",
        area: args.area ?? null,
      });
      const summary = `Added routine "${routine.label}" ${routine.startTime}–${routine.endTime} on ${args.weekdays.join("/")}.`;
      await recordMutation(ctx.userId, "add_routine", args, summary, ctx.source);
      return { summary, data: routineView(routine) };
    },
  }),
  defineTool({
    name: "remove_routine",
    title: "Remove routine",
    kind: "destructive",
    input: schemas.removeRoutineInput,
    description:
      "Deletes a routine so it stops being planned (existing blocks stay). Identify it by routineId or label. Confirm with the user first.",
    async describe(ctx, args) {
      const routines = await listRoutines(ctx.userId);
      const routine = args.routineId
        ? routines.find((entry) => entry.id === args.routineId)
        : findOneByName(routines, args.label ?? "", (entry) => entry.label, "routine");
      if (!routine) throw new ToolFailure(`No routine with id ${args.routineId}.`);
      return `Remove the routine "${routine.label}" (${routine.startTime}–${routine.endTime})?`;
    },
    async run(ctx, args) {
      const routines = await listRoutines(ctx.userId);
      const routine = args.routineId
        ? routines.find((entry) => entry.id === args.routineId)
        : findOneByName(routines, args.label ?? "", (entry) => entry.label, "routine");
      if (!routine) throw new ToolFailure(`No routine with id ${args.routineId}.`);
      await deleteRoutine(ctx.userId, routine.id);
      const summary = `Removed routine "${routine.label}".`;
      await recordMutation(ctx.userId, "remove_routine", args, summary, ctx.source);
      return { summary, data: { id: routine.id, removed: true } };
    },
  }),
];
