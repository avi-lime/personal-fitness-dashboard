import "server-only";
import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { McpAuthError, resolveContext, type McpContext } from "./context";
import { toolError, toolResult } from "./response";
import { ToolFailure } from "./tools/write";
import * as read from "./tools/read";
import * as write from "./tools/write";
import * as schemas from "./schemas";

/**
 * Runs a tool body with the authenticated context, converting expected failures
 * into tool errors instead of transport errors.
 */
async function run(
  ctx: ServerContext,
  handler: (mcp: McpContext) => Promise<{ summary: string; data: unknown }>,
) {
  try {
    const mcpContext = await resolveContext(ctx.http?.authInfo);
    const { summary, data } = await handler(mcpContext);
    return toolResult(summary, data);
  } catch (error) {
    if (error instanceof McpAuthError) return toolError(error.message);
    if (error instanceof ToolFailure) return toolError(error.message);
    return toolError(
      error instanceof Error ? `Request failed: ${error.message}` : "Request failed.",
    );
  }
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const;
const WRITES = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;

/** Registers all 17 tools. This is the entire MCP surface — nothing generic. */
export function registerTools(server: McpServer): void {
  // --- Read ---------------------------------------------------------------

  server.registerTool(
    "get_today",
    {
      title: "Get today",
      description:
        "Today's snapshot: every active goal with its current value, target and status, the day's nutrition/water/sleep/workout totals, latest weight, and the single suggested next action. Start here for general questions about how the day is going.",
      inputSchema: schemas.emptyInput,
      annotations: READ_ONLY,
    },
    async (_args, ctx) =>
      run(ctx, async (mcp) => {
        const data = await read.getToday(mcp);
        return {
          summary: `${data.date}: ${data.goals.filter((goal) => goal.status === "complete").length}/${data.goals.length} goals complete. Next: ${data.nextAction.label}.`,
          data,
        };
      }),
  );

  server.registerTool(
    "get_goals",
    {
      title: "Get goals",
      description:
        "All configured goals with their full configuration (type, unit, target, period, metric source, visibility). Call this before creating, updating or completing a goal so you use the right id and do not duplicate an existing goal.",
      inputSchema: schemas.emptyInput,
      annotations: READ_ONLY,
    },
    async (_args, ctx) =>
      run(ctx, async (mcp) => {
        const data = await read.getGoals(mcp);
        return { summary: `${data.goals.length} goals configured.`, data };
      }),
  );

  server.registerTool(
    "get_goal",
    {
      title: "Get one goal",
      description:
        "One goal's configuration plus its progress for the current period (day, week or month, depending on the goal).",
      inputSchema: schemas.getGoalInput,
      annotations: READ_ONLY,
    },
    async (args, ctx) =>
      run(ctx, async (mcp) => {
        const data = await read.getGoalWithProgress(mcp, args);
        if (!data) throw new ToolFailure(`No goal found with id ${args.goalId}.`);
        return {
          summary: `${data.goal.name}: ${data.progress.current}${
            data.progress.target !== null ? ` of ${data.progress.target}` : ""
          }${data.goal.unit ? ` ${data.goal.unit}` : ""} (${data.progress.status}).`,
          data,
        };
      }),
  );

  server.registerTool(
    "get_food_log",
    {
      title: "Get food log",
      description:
        "Every food entry for one calendar day, with the day's calorie and macronutrient totals. Defaults to today.",
      inputSchema: schemas.getFoodLogInput,
      annotations: READ_ONLY,
    },
    async (args, ctx) =>
      run(ctx, async (mcp) => {
        const data = await read.getFoodLog(mcp, args);
        return {
          summary: `${data.date}: ${data.entries.length} entries, ${data.totals.calories} kcal and ${data.totals.proteinG} g protein.`,
          data,
        };
      }),
  );

  server.registerTool(
    "get_workout",
    {
      title: "Get workout",
      description:
        "Workouts for one calendar day, including exercises, sets and the previous session recorded for each exercise (for comparing progressive overload). Defaults to today.",
      inputSchema: schemas.getWorkoutInput,
      annotations: READ_ONLY,
    },
    async (args, ctx) =>
      run(ctx, async (mcp) => {
        const data = await read.getWorkout(mcp, args);
        return {
          summary:
            data.workouts.length === 0
              ? `No workouts recorded on ${data.date}.`
              : `${data.workouts.length} workout(s) on ${data.date}: ${data.workouts.map((workout) => workout.name).join(", ")}.`,
          data,
        };
      }),
  );

  server.registerTool(
    "get_weight_history",
    {
      title: "Get weight history",
      description:
        "Weigh-ins between two dates (inclusive, maximum 366 days), with the latest value, 7-day average and change over the range.",
      inputSchema: schemas.getWeightHistoryInput,
      annotations: READ_ONLY,
    },
    async (args, ctx) =>
      run(ctx, async (mcp) => {
        const data = await read.getWeightHistory(mcp, args);
        return {
          summary: `${data.entries.length} weigh-ins between ${data.startDate} and ${data.endDate}.`,
          data,
        };
      }),
  );

  server.registerTool(
    "get_weekly_summary",
    {
      title: "Get weekly summary",
      description:
        "Averages, workout count, weight trend and per-goal adherence for one week. Any date inside the week works; it is snapped to that week's Monday. Defaults to the current week.",
      inputSchema: schemas.getWeeklySummaryInput,
      annotations: READ_ONLY,
    },
    async (args, ctx) =>
      run(ctx, async (mcp) => {
        const data = await read.getWeeklySummaryTool(mcp, args);
        return {
          summary: `Week of ${data.weekStart}: ${data.averages.calories} kcal/day, ${data.averages.protein} g protein/day, ${data.workouts} workouts.`,
          data,
        };
      }),
  );

  // --- Write --------------------------------------------------------------

  server.registerTool(
    "log_food",
    {
      title: "Log food",
      description:
        "Records one food entry. Calories are required; protein, carbs and fat are optional — omit them rather than estimating. Defaults to now and meal type 'other'.",
      inputSchema: schemas.logFoodInput,
      annotations: WRITES,
    },
    async (args, ctx) => run(ctx, (mcp) => write.logFoodTool(mcp, args)),
  );

  server.registerTool(
    "log_water",
    {
      title: "Log water",
      description: "Records water intake in millilitres. Defaults to now.",
      inputSchema: schemas.logWaterInput,
      annotations: WRITES,
    },
    async (args, ctx) => run(ctx, (mcp) => write.logWaterTool(mcp, args)),
  );

  server.registerTool(
    "log_weight",
    {
      title: "Log weight",
      description: "Records a weigh-in in kilograms, with an optional note. Defaults to now.",
      inputSchema: schemas.logWeightInput,
      annotations: WRITES,
    },
    async (args, ctx) => run(ctx, (mcp) => write.logWeightTool(mcp, args)),
  );

  server.registerTool(
    "log_sleep",
    {
      title: "Log sleep",
      description:
        "Records one sleep period from start to end (ISO-8601 timestamps). The entry is attributed to the day the user woke up. Optional quality is 1–5.",
      inputSchema: schemas.logSleepInput,
      annotations: WRITES,
    },
    async (args, ctx) => run(ctx, (mcp) => write.logSleepTool(mcp, args)),
  );

  server.registerTool(
    "log_workout",
    {
      title: "Log workout",
      description:
        "Creates a training session for a day and, unless told otherwise, marks it complete. Exercises and sets are added in the web app.",
      inputSchema: schemas.logWorkoutInput,
      annotations: WRITES,
    },
    async (args, ctx) => run(ctx, (mcp) => write.logWorkoutTool(mcp, args)),
  );

  server.registerTool(
    "add_goal",
    {
      title: "Add goal",
      description:
        "Creates a goal. Set metricKey to derive progress automatically from logged entries (for example 'protein'); omit it for a goal recorded by hand with complete_goal. Check get_goals first to avoid duplicates.",
      inputSchema: schemas.addGoalInput,
      annotations: WRITES,
    },
    async (args, ctx) => run(ctx, (mcp) => write.addGoalTool(mcp, args)),
  );

  server.registerTool(
    "update_goal",
    {
      title: "Update goal",
      description:
        "Changes one or more fields on an existing goal. Only the fields you pass are modified. Set active:false to pause a goal without removing it.",
      inputSchema: schemas.updateGoalInput,
      annotations: WRITES,
    },
    async (args, ctx) => run(ctx, (mcp) => write.updateGoalTool(mcp, args)),
  );

  server.registerTool(
    "remove_goal",
    {
      title: "Remove goal",
      description:
        "Archives a goal: it disappears from the dashboard and checklist while its past entries are kept. Confirm with the user before calling this.",
      inputSchema: schemas.removeGoalInput,
      annotations: { ...WRITES, destructiveHint: true },
    },
    async (args, ctx) => run(ctx, (mcp) => write.removeGoalTool(mcp, args)),
  );

  server.registerTool(
    "complete_goal",
    {
      title: "Complete goal",
      description:
        "Records progress against a manually tracked goal (value defaults to 1, date defaults to today). Rejected for goals derived from a metric — log the underlying entry instead.",
      inputSchema: schemas.completeGoalInput,
      annotations: WRITES,
    },
    async (args, ctx) => run(ctx, (mcp) => write.completeGoalTool(mcp, args)),
  );

  server.registerTool(
    "add_note",
    {
      title: "Add note",
      description: "Adds a free-text note to a day. Defaults to today.",
      inputSchema: schemas.addNoteInput,
      annotations: WRITES,
    },
    async (args, ctx) => run(ctx, (mcp) => write.addNoteTool(mcp, args)),
  );
}
