import { notFound } from "next/navigation";
import { SessionView } from "@/components/training/session-view";
import { requireContext } from "@/server/auth";
import { getWorkout } from "@/server/services/workouts";
import { sessionMeta } from "@/server/services/training";

export const dynamic = "force-dynamic";
export const metadata = { title: "Session · Life Dashboard" };

export default async function SessionPage({ params }: PageProps<"/training/session/[id]">) {
  const { user } = await requireContext();
  const { id } = await params;
  const workout = await getWorkout(user.id, id);
  if (!workout) notFound();
  const meta = await sessionMeta(user.id, workout);
  return <SessionView workout={workout} meta={meta} />;
}
