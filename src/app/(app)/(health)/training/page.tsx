import { WorkoutList } from "@/components/workouts/workout-list";
import { LevelStrip } from "@/components/training/level-strip";
import { NextWorkoutCard } from "@/components/training/next-workout-card";
import { SetupCard } from "@/components/training/setup-card";
import { PreferencesDisclosure } from "@/components/training/preferences-disclosure";
import { MuscleChip } from "@/components/training/muscle-chip";
import { BodyMap } from "@/components/training/body-map";
import { MuscleList } from "@/components/training/muscle-list";
import { MissionsList } from "@/components/training/missions-list";
import { RewardShop } from "@/components/training/reward-shop";
import { AchievementsGrid } from "@/components/training/achievements-grid";
import { TrainingTabs } from "@/components/training/training-tabs";
import { Card } from "@/components/ui/card";
import { requireContext } from "@/server/auth";
import { getTrainingSnapshot, scoreLabel } from "@/server/services/training";
import { listRewards } from "@/server/services/rpg";
import { listRecentWorkouts, listWorkoutTemplates } from "@/server/services/workouts";
import { isDayKey } from "@/lib/fitness/programs";
import { formatShortDate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "Training · Life Dashboard" };

export default async function TrainingPage({ searchParams }: PageProps<"/training">) {
  const { user, timezone } = await requireContext();
  const params = await searchParams;
  const requestedDay = Array.isArray(params.day) ? params.day[0] : params.day;
  const day = isDayKey(requestedDay) ? requestedDay : null;

  const [snapshot, rewards, workouts, templates] = await Promise.all([
    getTrainingSnapshot(user.id, timezone, { day }),
    listRewards(user.id),
    listRecentWorkouts(user.id, 25),
    listWorkoutTemplates(user.id),
  ]);
  const { rpg } = snapshot;
  const claimable = rpg.missions.filter((mission) => mission.complete && !mission.claimed).length;

  const today = (
    <div className="space-y-5">
      {!snapshot.preferences.configured ? <SetupCard preferences={snapshot.preferences} /> : null}
      <NextWorkoutCard plan={snapshot.plan} program={snapshot.preferences.program} active={snapshot.active} day={day} />

      {snapshot.rest.length > 0 || snapshot.attention.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {snapshot.rest.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-xs tracking-widest text-muted-foreground uppercase">Needs rest</h3>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.rest.map((status) => (
                  <MuscleChip key={status.muscle} muscle={status.muscle} state={status.state} detail={`${Math.round(status.recovery * 100)}%`} />
                ))}
              </div>
            </section>
          ) : null}
          {snapshot.attention.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-xs tracking-widest text-muted-foreground uppercase">Needs attention</h3>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.attention.slice(0, 6).map((status) => (
                  <MuscleChip
                    key={status.muscle}
                    muscle={status.muscle}
                    state={status.state}
                    detail={status.daysSince === null ? "never" : `${status.daysSince}d`}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <MissionsList title="Today's missions" missions={rpg.missions.filter((mission) => mission.scope === "daily")} />
      {snapshot.preferences.configured ? <PreferencesDisclosure preferences={snapshot.preferences} /> : null}
    </div>
  );

  const body = (
    <div className="space-y-6">
      <Card className="p-4">
        <BodyMap muscles={snapshot.muscles} equipment={snapshot.preferences.equipment} />
      </Card>
      <MuscleList muscles={snapshot.muscles} />
    </div>
  );

  const quests = (
    <div className="space-y-6">
      <MissionsList title="Today" missions={rpg.missions.filter((mission) => mission.scope === "daily")} />
      <MissionsList title="This week" missions={rpg.missions.filter((mission) => mission.scope === "weekly")} />
      <RewardShop rewards={rewards} gold={rpg.gold} />
      <AchievementsGrid achievements={rpg.achievements} />
    </div>
  );

  const log = (
    <div className="space-y-6">
      {snapshot.prs.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-xs tracking-widest text-muted-foreground uppercase">Recent records</h3>
          <ul className="divide-y divide-border/60 rounded-xl bg-surface-3 px-3">
            {snapshot.prs.slice(0, 8).map((record) => (
              <li key={`${record.workoutId}-${record.identity}`} className="flex items-baseline gap-3 py-2 text-sm">
                <span className="w-14 shrink-0 text-xs text-muted-foreground tabular">{formatShortDate(record.date)}</span>
                <span className="min-w-0 flex-1 truncate">{record.exerciseName}</span>
                <span className="tabular">{scoreLabel(record)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <WorkoutList
        workouts={workouts}
        templates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          exercises: template.exercises.map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            targetSets: exercise.targetSets,
            targetReps: exercise.targetReps,
          })),
        }))}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <h1 className="font-display text-3xl">Training</h1>
        <LevelStrip rpg={rpg} />
      </div>
      <TrainingTabs panels={{ today, body, quests, log }} badges={{ quests: claimable }} />
    </div>
  );
}
