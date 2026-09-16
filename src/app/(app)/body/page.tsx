import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WeightPanel } from "@/components/body/weight-panel";
import { SleepPanel } from "@/components/body/sleep-panel";
import { WaterPanel } from "@/components/body/water-panel";
import { requireContext } from "@/server/auth";
import { listSleepEntries, listWeightEntries } from "@/server/services/body";
import { listWaterLogs } from "@/server/services/water";
import { listGoals, toGoalLike } from "@/server/services/goals";
import { computeWeightStats } from "@/lib/aggregate";
import { hoursBetween, toLocalDate, toLocalTime } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "Body · Life Dashboard" };

export default async function BodyPage() {
  const { user, timezone, profile } = await requireContext();
  const today = toLocalDate(new Date(), timezone);

  const [weights, sleep, water, goals] = await Promise.all([
    listWeightEntries(user.id, 120),
    listSleepEntries(user.id, 60),
    listWaterLogs(user.id, today),
    listGoals(user.id, false),
  ]);

  const series = [...weights]
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
    .map((entry) => ({ date: entry.localDate, weightKg: entry.weightKg }));

  const waterGoal = goals
    .map(toGoalLike)
    .find((goal) => goal.metricKey === "water_ml" && goal.period === "daily");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Body</h1>
        <p className="text-sm text-muted-foreground">Weight, sleep and hydration history.</p>
      </div>

      <Tabs defaultValue="weight">
        <TabsList>
          <TabsTrigger value="weight">Weight</TabsTrigger>
          <TabsTrigger value="sleep">Sleep</TabsTrigger>
          <TabsTrigger value="water">Water</TabsTrigger>
        </TabsList>

        <TabsContent value="weight" className="pt-4">
          <WeightPanel
            stats={computeWeightStats(series, today)}
            series={series}
            targetWeightKg={profile.targetWeightKg}
            startingWeightKg={profile.startingWeightKg}
            entries={weights.map((entry) => ({
              id: entry.id,
              date: entry.localDate,
              weightKg: entry.weightKg,
              note: entry.note,
              time: toLocalTime(entry.occurredAt, timezone),
            }))}
          />
        </TabsContent>

        <TabsContent value="sleep" className="pt-4">
          <SleepPanel
            entries={sleep.map((entry) => ({
              id: entry.id,
              date: entry.localDate,
              start: toLocalTime(entry.startAt, timezone),
              end: toLocalTime(entry.endAt, timezone),
              hours: hoursBetween(entry.startAt, entry.endAt),
              quality: entry.quality,
              note: entry.note,
            }))}
          />
        </TabsContent>

        <TabsContent value="water" className="pt-4">
          <WaterPanel
            targetLitres={waterGoal?.targetValue ?? null}
            entries={water.map((entry) => ({
              id: entry.id,
              milliliters: entry.milliliters,
              time: toLocalTime(entry.occurredAt, timezone),
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
