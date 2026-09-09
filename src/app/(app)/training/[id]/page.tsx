import { notFound } from "next/navigation";
import { WorkoutEditor } from "@/components/workouts/workout-editor";
import { requireContext } from "@/server/auth";
import { getWorkout, previousPerformance, type PreviousPerformance } from "@/server/services/workouts";

export const dynamic = "force-dynamic";

export default async function WorkoutPage({ params }: PageProps<"/training/[id]">) {
  const { id } = await params;
  const { user } = await requireContext();
  const workout = await getWorkout(user.id, id);
  if (!workout) notFound();

  const results = await Promise.all(
    workout.exercises.map((exercise) =>
      previousPerformance(user.id, exercise.name, workout.date, workout.id),
    ),
  );
  const previousByExercise: Record<string, PreviousPerformance | null> = {};
  workout.exercises.forEach((exercise, index) => {
    previousByExercise[exercise.name.toLowerCase()] = results[index];
  });

  return <WorkoutEditor workout={workout} previousByExercise={previousByExercise} />;
}
