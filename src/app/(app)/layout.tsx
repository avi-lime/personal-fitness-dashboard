import { AppHeader } from "@/components/layout/app-header";
import { LogProvider } from "@/components/log/log-provider";
import { requireContext } from "@/server/auth";
import { listFoods } from "@/server/services/food";
import { latestWeight } from "@/server/services/body";
import { listWorkoutTemplates } from "@/server/services/workouts";
import { toLocalDate } from "@/lib/date";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { user, timezone } = await requireContext();
  const [foods, templates, weight] = await Promise.all([
    listFoods(user.id),
    listWorkoutTemplates(user.id),
    latestWeight(user.id),
  ]);

  return (
    <LogProvider
      foods={foods}
      workoutTemplates={templates.map((template) => ({ id: template.id, name: template.name }))}
      latestWeight={weight?.weightKg ?? null}
    >
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:outline-2 focus:outline-ring"
        >
          Skip to content
        </a>
        <AppHeader date={toLocalDate(new Date(), timezone)} timezone={timezone} />
        <main id="main" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 lg:px-6 lg:py-8">
          {children}
        </main>
      </div>
    </LogProvider>
  );
}
