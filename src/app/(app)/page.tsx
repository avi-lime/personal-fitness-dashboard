import { NextActionCard } from "@/components/dashboard/next-action-card";
import { GoalCard } from "@/components/dashboard/goal-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { TrainingCard } from "@/components/dashboard/training-card";
import { BodyCard } from "@/components/dashboard/body-card";
import { WeekCard } from "@/components/dashboard/week-card";
import { NotesCard } from "@/components/dashboard/notes-card";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { requireContext } from "@/server/auth";
import { getTodaySnapshot } from "@/server/services/today";
import { previousPerformance, type PreviousPerformance } from "@/server/services/workouts";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, timezone, profile, sections } = await requireContext();
  const snapshot = await getTodaySnapshot(user.id, timezone);

  const dashboardGoals = snapshot.goals.filter((goal) => goal.active && goal.visibleOnDashboard);
  const checklistGoals = snapshot.goals.filter((goal) => goal.active && goal.showInChecklist);
  const checklistDone = checklistGoals.filter(
    (goal) => snapshot.progressById.get(goal.id)?.status === "complete",
  ).length;

  const workout = snapshot.workouts[0] ?? null;
  const previousByExercise: Record<string, PreviousPerformance | null> = {};
  if (workout) {
    const results = await Promise.all(
      workout.exercises.map((exercise) =>
        previousPerformance(user.id, exercise.name, snapshot.date, workout.id),
      ),
    );
    workout.exercises.forEach((exercise, index) => {
      previousByExercise[exercise.name.toLowerCase()] = results[index];
    });
  }

  return (
    <div className="space-y-5">
      {sections.nextAction ? (
        <NextActionCard
          action={snapshot.nextAction}
          checklist={snapshot.checklist}
          checklistTotal={checklistGoals.length}
          checklistDone={checklistDone}
        />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {sections.today ? (
            <section aria-labelledby="today-heading" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 id="today-heading" className="text-sm font-medium">
                  Today
                </h2>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/goals">Manage goals</Link>
                </Button>
              </div>
              {dashboardGoals.length === 0 ? (
                <EmptyState
                  title="No goals on the dashboard"
                  description="Create a goal, or make an existing one visible here."
                  action={
                    <Button size="sm" asChild>
                      <Link href="/goals">Go to goals</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {dashboardGoals.map((goal) => {
                    const progress = snapshot.progressById.get(goal.id);
                    return progress ? (
                      <GoalCard key={goal.id} goal={goal} progress={progress} />
                    ) : null;
                  })}
                </div>
              )}
            </section>
          ) : null}

          {sections.training ? (
            <TrainingCard workout={workout} previousByExercise={previousByExercise} />
          ) : null}

          {sections.body ? (
            <BodyCard
              stats={snapshot.weight}
              series={snapshot.weightSeries}
              targetWeightKg={profile.targetWeightKg}
            />
          ) : null}
        </div>

        <div className="space-y-5">
          {sections.quickActions ? <QuickActions /> : null}
          {sections.weekly ? (
            <WeekCard
              summary={snapshot.week}
              days={snapshot.weekDays}
              goalCompletion={snapshot.checklist}
            />
          ) : null}
          {sections.notes ? <NotesCard notes={snapshot.notes} /> : null}
        </div>
      </div>
    </div>
  );
}
