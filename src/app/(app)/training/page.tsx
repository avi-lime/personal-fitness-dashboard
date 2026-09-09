import { WorkoutList } from "@/components/workouts/workout-list";
import { requireContext } from "@/server/auth";
import { listRecentWorkouts, listWorkoutTemplates } from "@/server/services/workouts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Training · Life Dashboard" };

export default async function TrainingPage() {
  const { user } = await requireContext();
  const [workouts, templates] = await Promise.all([
    listRecentWorkouts(user.id, 25),
    listWorkoutTemplates(user.id),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Training</h1>
        <p className="text-sm text-muted-foreground">
          Sessions, sets and templates. Previous performance is shown inside each workout.
        </p>
      </div>
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
}
