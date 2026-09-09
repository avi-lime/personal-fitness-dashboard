import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NutritionSummary } from "@/components/food/nutrition-summary";
import { FoodLogList } from "@/components/food/food-log-list";
import { FoodsManager } from "@/components/food/foods-manager";
import { MealTemplates } from "@/components/food/meal-templates";
import { requireContext } from "@/server/auth";
import { listFoodLogs, listFoods, listMealTemplates } from "@/server/services/food";
import { sumNutrition } from "@/lib/nutrition";
import { listGoals, toGoalLike } from "@/server/services/goals";
import { toLocalDate, toLocalTime } from "@/lib/date";
import type { MetricKey } from "@/lib/domain";

export const dynamic = "force-dynamic";
export const metadata = { title: "Food · Life Dashboard" };

export default async function FoodPage() {
  const { user, timezone } = await requireContext();
  const today = toLocalDate(new Date(), timezone);

  const [entries, foods, templates, goals] = await Promise.all([
    listFoodLogs(user.id, today),
    listFoods(user.id),
    listMealTemplates(user.id),
    listGoals(user.id, false),
  ]);

  const targetFor = (metric: MetricKey): number | null =>
    goals.map(toGoalLike).find((goal) => goal.metricKey === metric && goal.period === "daily")
      ?.targetValue ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Food</h1>
        <p className="text-sm text-muted-foreground">
          Daily totals are calculated from the entries below — nothing is stored twice.
        </p>
      </div>

      <NutritionSummary
        totals={sumNutrition(entries)}
        entryCount={entries.length}
        targets={{
          calories: targetFor("calories"),
          proteinG: targetFor("protein"),
          carbsG: targetFor("carbs"),
          fatG: targetFor("fat"),
        }}
      />

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="foods">Foods</TabsTrigger>
          <TabsTrigger value="meals">Meals</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="pt-4">
          <FoodLogList
            entries={entries.map((entry) => ({
              ...entry,
              time: toLocalTime(entry.occurredAt, timezone),
            }))}
            foods={foods}
          />
        </TabsContent>
        <TabsContent value="foods" className="pt-4">
          <FoodsManager foods={foods} />
        </TabsContent>
        <TabsContent value="meals" className="pt-4">
          <MealTemplates
            templates={templates.map((template) => ({
              id: template.id,
              name: template.name,
              mealType: template.mealType,
              items: template.items,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
