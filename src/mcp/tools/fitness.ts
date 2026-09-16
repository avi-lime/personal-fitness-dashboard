import "server-only";
import { defineTool } from "../registry";
import { ToolFailure } from "./write";
import * as read from "./read";
import * as write from "./write";
import * as schemas from "../schemas";
import { getGoal } from "@/server/services/goals";

/** The original 17 tools: goals, nutrition, water, sleep, weight, workouts, notes. */
export const fitnessTools = [
  // --- Read -----------------------------------------------------------------
  defineTool({
    name: "get_today",
    title: "Get today",
    kind: "read",
    input: schemas.emptyInput,
    description:
      "Today's snapshot: every active goal with its current value, target and status, the day's nutrition/water/sleep/workout totals, latest weight, and the single suggested next action. Start here for general questions about how the day is going.",
    async run(ctx) {
      const data = await read.getToday(ctx);
      const done = data.goals.filter((goal) => goal.status === "complete").length;
      return {
        summary: `${data.date}: ${done}/${data.goals.length} goals complete. Next: ${data.nextAction.label}.`,
        data,
      };
    },
  }),
  defineTool({
    name: "get_goals",
    title: "Get goals",
    kind: "read",
    input: schemas.emptyInput,
    description:
      "All configured goals with their full configuration (type, unit, target, period, metric source, visibility). Call this before creating, updating or completing a goal so you use the right id and do not duplicate an existing goal.",
    async run(ctx) {
      const data = await read.getGoals(ctx);
      return { summary: `${data.goals.length} goals configured.`, data };
    },
  }),
  defineTool({
    name: "get_goal",
    title: "Get one goal",
    kind: "read",
    input: schemas.getGoalInput,
    description:
      "One goal's configuration plus its progress for the current period (day, week or month, depending on the goal).",
    async run(ctx, args) {
      const data = await read.getGoalWithProgress(ctx, args);
      if (!data) throw new ToolFailure(`No goal found with id ${args.goalId}.`);
      const target = data.progress.target !== null ? ` of ${data.progress.target}` : "";
      const unit = data.goal.unit ? ` ${data.goal.unit}` : "";
      return {
        summary: `${data.goal.name}: ${data.progress.current}${target}${unit} (${data.progress.status}).`,
        data,
      };
    },
  }),
  defineTool({
    name: "get_food_log",
    title: "Get food log",
    kind: "read",
    input: schemas.getFoodLogInput,
    description:
      "Every food entry for one calendar day, with the day's calorie and macronutrient totals. Defaults to today.",
    async run(ctx, args) {
      const data = await read.getFoodLog(ctx, args);
      return {
        summary: `${data.date}: ${data.entries.length} entries, ${data.totals.calories} kcal and ${data.totals.proteinG} g protein.`,
        data,
      };
    },
  }),
  defineTool({
    name: "get_workout",
    title: "Get workout",
    kind: "read",
    input: schemas.getWorkoutInput,
    description:
      "Workouts for one calendar day, including exercises, sets and the previous session recorded for each exercise (for comparing progressive overload). Defaults to today.",
    async run(ctx, args) {
      const data = await read.getWorkout(ctx, args);
      return {
        summary:
          data.workouts.length === 0
            ? `No workouts recorded on ${data.date}.`
            : `${data.workouts.length} workout(s) on ${data.date}: ${data.workouts.map((workout) => workout.name).join(", ")}.`,
        data,
      };
    },
  }),
  defineTool({
    name: "get_weight_history",
    title: "Get weight history",
    kind: "read",
    input: schemas.getWeightHistoryInput,
    description:
      "Weigh-ins between two dates (inclusive, maximum 366 days), with the latest value, 7-day average and change over the range.",
    async run(ctx, args) {
      const data = await read.getWeightHistory(ctx, args);
      return {
        summary: `${data.entries.length} weigh-ins between ${data.startDate} and ${data.endDate}.`,
        data,
      };
    },
  }),
  defineTool({
    name: "get_weekly_summary",
    title: "Get weekly summary",
    kind: "read",
    input: schemas.getWeeklySummaryInput,
    description:
      "Averages, workout count, weight trend and per-goal adherence for one week. Any date inside the week works; it is snapped to that week's Monday. Defaults to the current week.",
    async run(ctx, args) {
      const data = await read.getWeeklySummaryTool(ctx, args);
      return {
        summary: `Week of ${data.weekStart}: ${data.averages.calories} kcal/day, ${data.averages.protein} g protein/day, ${data.workouts} workouts.`,
        data,
      };
    },
  }),

  // --- Write ----------------------------------------------------------------
  defineTool({
    name: "log_food",
    title: "Log food",
    kind: "write",
    input: schemas.logFoodInput,
    description:
      "Records one food entry. Calories are required; protein, carbs and fat are optional — omit them rather than estimating. Defaults to now and meal type 'other'.",
    run: (ctx, args) => write.logFoodTool(ctx, args),
  }),
  defineTool({
    name: "log_water",
    title: "Log water",
    kind: "write",
    input: schemas.logWaterInput,
    description: "Records water intake in millilitres. Defaults to now.",
    run: (ctx, args) => write.logWaterTool(ctx, args),
  }),
  defineTool({
    name: "log_weight",
    title: "Log weight",
    kind: "write",
    input: schemas.logWeightInput,
    description: "Records a weigh-in in kilograms, with an optional note. Defaults to now.",
    run: (ctx, args) => write.logWeightTool(ctx, args),
  }),
  defineTool({
    name: "log_sleep",
    title: "Log sleep",
    kind: "write",
    input: schemas.logSleepInput,
    description:
      "Records one sleep period from start to end (ISO-8601 timestamps). The entry is attributed to the day the user woke up. Optional quality is 1–5.",
    run: (ctx, args) => write.logSleepTool(ctx, args),
  }),
  defineTool({
    name: "log_workout",
    title: "Log workout",
    kind: "write",
    input: schemas.logWorkoutInput,
    description:
      "Creates a training session for a day and, unless told otherwise, marks it complete. Exercises and sets are added in the web app.",
    run: (ctx, args) => write.logWorkoutTool(ctx, args),
  }),
  defineTool({
    name: "add_goal",
    title: "Add goal",
    kind: "write",
    input: schemas.addGoalInput,
    description:
      "Creates a goal. Set metricKey to derive progress automatically from logged entries (for example 'protein'); omit it for a goal recorded by hand with complete_goal. Check get_goals first to avoid duplicates.",
    run: (ctx, args) => write.addGoalTool(ctx, args),
  }),
  defineTool({
    name: "update_goal",
    title: "Update goal",
    kind: "write",
    input: schemas.updateGoalInput,
    description:
      "Changes one or more fields on an existing goal. Only the fields you pass are modified. Set active:false to pause a goal without removing it.",
    run: (ctx, args) => write.updateGoalTool(ctx, args),
  }),
  defineTool({
    name: "remove_goal",
    title: "Remove goal",
    kind: "destructive",
    input: schemas.removeGoalInput,
    description:
      "Archives a goal: it disappears from the dashboard and checklist while its past entries are kept. Confirm with the user before calling this.",
    run: (ctx, args) => write.removeGoalTool(ctx, args),
    async describe(ctx, args) {
      const goal = await getGoal(ctx.userId, args.goalId);
      return goal ? `Archive the goal "${goal.name}"?` : `Archive goal ${args.goalId}?`;
    },
  }),
  defineTool({
    name: "complete_goal",
    title: "Complete goal",
    kind: "write",
    input: schemas.completeGoalInput,
    description:
      "Records progress against a manually tracked goal (value defaults to 1, date defaults to today). Rejected for goals derived from a metric — log the underlying entry instead.",
    run: (ctx, args) => write.completeGoalTool(ctx, args),
  }),
  defineTool({
    name: "add_note",
    title: "Add note",
    kind: "write",
    input: schemas.addNoteInput,
    description: "Adds a free-text note to a day. Defaults to today.",
    run: (ctx, args) => write.addNoteTool(ctx, args),
  }),
];
