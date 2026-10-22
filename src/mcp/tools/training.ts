import "server-only";
import { defineTool } from "../registry";
import { recordMutation } from "../audit";
import { ToolFailure } from "./write";
import { findOneByName } from "./match";
import * as schemas from "../schemas";
import {
  getTrainingPreferences,
  getTrainingSnapshot,
  logSet,
  saveTrainingPreferences,
  scoreLabel,
  startPlannedWorkout,
  type TrainingSnapshot,
} from "@/server/services/training";
import { claimMission, createReward, listRewards, redeemReward } from "@/server/services/rpg";
import { MUSCLE_META } from "@/lib/fitness/muscles";
import { PROGRAMS } from "@/lib/fitness/programs";
import { EQUIPMENT_SETUP_LABELS } from "@/lib/fitness/exercises";
import type { PlannedWorkout } from "@/lib/fitness/planner";
import type { MuscleStatus } from "@/lib/fitness/status";

/**
 * Training and the game layer. Reads are cheap and safe; the writes either
 * log training (start_workout, log_set) or touch the game ledger
 * (claim_mission, redeem_reward). None of them is destructive.
 */

const label = (status: MuscleStatus) => MUSCLE_META[status.muscle].label;

function muscleLine(status: MuscleStatus): string {
  if (status.state === "recovering") return `${label(status)} ${Math.round(status.recovery * 100)}% recovered`;
  if (status.daysSince === null) return `${label(status)} never trained`;
  return `${label(status)} ${status.daysSince}d ago, ${status.weeklySets}/${status.weeklyTarget} sets this week`;
}

function planView(plan: PlannedWorkout) {
  return {
    day: plan.day,
    label: plan.label,
    reason: plan.reason,
    restSuggested: plan.restSuggested,
    estimatedMinutes: plan.estimatedMinutes,
    exercises: plan.exercises.map((exercise) => ({
      name: exercise.name,
      key: exercise.key,
      muscles: exercise.primary,
      restSeconds: exercise.restSeconds,
      sets: exercise.sets,
      rule: exercise.rule,
      notes: exercise.notes,
      lastTime: exercise.last,
    })),
  };
}

function planSummary(plan: PlannedWorkout): string {
  const list = plan.exercises.map((exercise) => {
    const first = exercise.sets[0];
    const target = first.seconds
      ? `${first.seconds}s`
      : `${first.reps ?? "?"} reps${first.weightKg ? ` @ ${first.weightKg} kg` : ""}`;
    return `${exercise.name} ${exercise.sets.length}×${target}`;
  });
  return `${plan.label} day (~${plan.estimatedMinutes} min): ${list.join("; ")}. ${plan.reason}`;
}

function statusView(snapshot: TrainingSnapshot) {
  const { rpg } = snapshot;
  return {
    level: rpg.level.level,
    title: rpg.title,
    xp: rpg.xp.total,
    xpToNextLevel: rpg.level.needed - rpg.level.current,
    gold: rpg.gold,
    program: snapshot.preferences.program,
    equipment: snapshot.preferences.equipment,
    daysPerWeek: snapshot.preferences.daysPerWeek,
    activeWorkout: snapshot.active ? { id: snapshot.active.id, name: snapshot.active.name } : null,
    needsRest: snapshot.rest.map((status) => ({
      muscle: status.muscle,
      recoveredPercent: Math.round(status.recovery * 100),
      readyAt: status.readyAt?.toISOString() ?? null,
    })),
    needsAttention: snapshot.attention.map((status) => ({
      muscle: status.muscle,
      state: status.state,
      daysSince: status.daysSince,
      weeklySets: status.weeklySets,
      weeklyTarget: status.weeklyTarget,
    })),
    muscles: snapshot.muscles.map((muscle) => ({
      muscle: muscle.muscle,
      state: muscle.state,
      level: muscle.level.level,
      daysSince: muscle.daysSince,
      weeklySets: muscle.weeklySets,
    })),
    next: { day: snapshot.plan.day, label: snapshot.plan.label, reason: snapshot.plan.reason },
    missions: rpg.missions.map((mission) => ({
      key: mission.key,
      scope: mission.scope,
      title: mission.title,
      detail: mission.detail,
      progress: mission.progress,
      target: mission.target,
      reward: { xp: mission.xp, gold: mission.gold },
      complete: mission.complete,
      claimed: mission.claimed,
    })),
    recentPrs: snapshot.prs.slice(0, 5).map((record) => ({
      exercise: record.exerciseName,
      date: record.date,
      best: scoreLabel(record),
    })),
  };
}

export const trainingTools = [
  defineTool({
    name: "get_training_status",
    title: "Get training status",
    kind: "read",
    input: schemas.emptyInput,
    description:
      "The training picture: which muscles need rest (still recovering, with % recovered) and which need attention (overdue or under their weekly sets), each muscle's level, the next planned day, today's and this week's missions with progress, recent PRs, and the user's level, XP and gold. Start here for anything about workouts, muscles or the game.",
    async run(ctx) {
      const snapshot = await getTrainingSnapshot(ctx.userId, ctx.timezone);
      const rest = snapshot.rest.map(muscleLine);
      const attention = snapshot.attention.slice(0, 4).map(muscleLine);
      const open = snapshot.rpg.missions.filter((mission) => mission.complete && !mission.claimed);
      const summary = [
        `Level ${snapshot.rpg.level.level} ${snapshot.rpg.title}, ${snapshot.rpg.gold} gold.`,
        snapshot.active ? `In progress: ${snapshot.active.name}.` : `Next: ${snapshot.plan.label} day.`,
        rest.length ? `Resting: ${rest.join(", ")}.` : "Nothing is still recovering.",
        attention.length ? `Needs attention: ${attention.join(", ")}.` : "",
        open.length ? `${open.length} mission(s) ready to claim.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      return { summary, data: statusView(snapshot) };
    },
  }),
  defineTool({
    name: "get_next_workout",
    title: "Get next workout",
    kind: "read",
    input: schemas.getNextWorkoutInput,
    description:
      "The planned session: which day of the program and why, each exercise with its sets, target reps and suggested weight (from double progression on the last session), rest times, and what was lifted last time. Planned, not logged — use start_workout to begin it.",
    async run(ctx, args) {
      const snapshot = await getTrainingSnapshot(ctx.userId, ctx.timezone, { day: args.day ?? null });
      return { summary: planSummary(snapshot.plan), data: planView(snapshot.plan) };
    },
  }),
  defineTool({
    name: "start_workout",
    title: "Start the planned workout",
    kind: "write",
    input: schemas.startWorkoutInput,
    description:
      "Opens today's planned session with every set pre-filled with its target, ready to log with log_set. If a session is already open today it is resumed instead of duplicated.",
    async run(ctx, args) {
      const { workout, resumed, plan } = await startPlannedWorkout(ctx.userId, ctx.timezone, { day: args.day ?? null }, ctx.source);
      const summary = resumed
        ? `Resumed "${workout.name}" (${workout.exercises.length} exercises).`
        : `Started ${plan ? planSummary(plan) : workout.name}`;
      await recordMutation(ctx.userId, "start_workout", args, summary, ctx.source);
      return {
        summary,
        data: {
          workoutId: workout.id,
          name: workout.name,
          resumed,
          exercises: workout.exercises.map((exercise) => ({
            name: exercise.name,
            sets: exercise.sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg, completed: set.completed })),
          })),
        },
      };
    },
  }),
  defineTool({
    name: "log_set",
    title: "Log a set",
    kind: "write",
    input: schemas.logSetInput,
    description:
      'Logs one completed set ("bench 60 × 8", "plank 45 seconds") in today\'s open session — filling the next planned set for that exercise, or adding the exercise if it is not in the session. Opens a session if none is open. Reports XP and any personal record.',
    async run(ctx, args) {
      const result = await logSet(
        ctx.userId,
        ctx.timezone,
        {
          exercise: args.exercise,
          weightKg: args.weightKg ?? null,
          reps: args.reps ?? null,
          seconds: args.seconds ?? null,
          warmup: args.warmup ?? false,
        },
        ctx.source,
      );
      const what = args.seconds
        ? `${args.seconds}s`
        : `${args.weightKg ? `${args.weightKg} kg × ` : ""}${args.reps} reps`;
      const summary = `Logged ${args.warmup ? "a warm-up for " : ""}${result.exerciseName} set ${result.setNumber}: ${what}. +${result.xp} XP.${result.pr ? ` New PR: ${scoreLabel(result.pr)} (was ${result.pr.previous}${result.pr.kind === "e1rm" ? " kg est. 1RM" : ""}).` : ""}`;
      await recordMutation(ctx.userId, "log_set", args, summary, ctx.source);
      return { summary, data: result };
    },
  }),
  defineTool({
    name: "claim_mission",
    title: "Claim a mission",
    kind: "write",
    input: schemas.claimMissionInput,
    description:
      "Collects the XP and gold for a finished mission. Completion is checked against the user's actual history; a mission pays out once.",
    async run(ctx, args) {
      const snapshot = await getTrainingSnapshot(ctx.userId, ctx.timezone);
      const missions = snapshot.rpg.missions;
      const mission =
        missions.find((entry) => entry.key === args.mission) ??
        findOneByName(missions, args.mission, (entry) => entry.title, "mission");
      const result = await claimMission(ctx.userId, ctx.timezone, mission.key);
      if (!result.ok) throw new ToolFailure(result.error);
      const summary = `Claimed "${mission.title}": +${mission.xp} XP, +${mission.gold} gold.`;
      await recordMutation(ctx.userId, "claim_mission", args, summary, ctx.source);
      return { summary, data: { key: mission.key, xp: mission.xp, gold: mission.gold } };
    },
  }),
  defineTool({
    name: "add_reward",
    title: "Add a reward",
    kind: "write",
    input: schemas.addRewardInput,
    description:
      "Adds a real-life reward to the user's shop, priced in gold earned from missions — e.g. a cheat meal or new gym gear. Only add what the user asked for.",
    async run(ctx, args) {
      const reward = await createReward(ctx.userId, { name: args.name, cost: args.cost, notes: args.notes ?? null });
      const summary = `Added "${reward.name}" to the reward shop for ${reward.cost} gold.`;
      await recordMutation(ctx.userId, "add_reward", args, summary, ctx.source);
      return { summary, data: { id: reward.id, name: reward.name, cost: reward.cost } };
    },
  }),
  defineTool({
    name: "redeem_reward",
    title: "Redeem a reward",
    kind: "write",
    input: schemas.redeemRewardInput,
    description: "Spends gold on a reward from the shop. Fails, spending nothing, if there is not enough gold.",
    async run(ctx, args) {
      const rewards = await listRewards(ctx.userId);
      const reward = findOneByName(rewards, args.reward, (entry) => entry.name, "reward");
      const result = await redeemReward(ctx.userId, reward.id);
      if (!result.ok) throw new ToolFailure(result.error);
      const summary = `Redeemed "${reward.name}" for ${reward.cost} gold. ${result.balance} gold left.`;
      await recordMutation(ctx.userId, "redeem_reward", args, summary, ctx.source);
      return { summary, data: { reward: reward.name, cost: reward.cost, balance: result.balance } };
    },
  }),
  defineTool({
    name: "set_training_preferences",
    title: "Set training preferences",
    kind: "write",
    input: schemas.setTrainingPreferencesInput,
    description:
      "Changes the training program (ppl or push_pull), the equipment available (gym, dumbbells, bodyweight) or sessions per week. Only the fields passed change.",
    async run(ctx, args) {
      const current = await getTrainingPreferences(ctx.userId);
      const saved = await saveTrainingPreferences(ctx.userId, {
        program: args.program ?? current.program,
        equipment: args.equipment ?? current.equipment,
        daysPerWeek: args.daysPerWeek ?? current.daysPerWeek,
      });
      const summary = `Training set to ${PROGRAMS[saved.program].name}, ${saved.daysPerWeek}×/week, ${EQUIPMENT_SETUP_LABELS[saved.equipment].toLowerCase()}.`;
      await recordMutation(ctx.userId, "set_training_preferences", args, summary, ctx.source);
      return { summary, data: saved };
    },
  }),
];
