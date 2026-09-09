"use client";

import { useState } from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { FoodDialog, toDialogEntry, type FoodDialogEntry } from "@/components/log/food-dialog";
import {
  deleteFoodLogAction,
  duplicateFoodLogAction,
  saveMealTemplateAction,
} from "@/server/actions/logging";
import { MEAL_TYPES, type MealType } from "@/lib/domain";
import { formatValue } from "@/lib/format";
import type { Food, FoodLog } from "@/db/schema";

const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
  other: "Other",
};

/** Today's entries grouped by meal, with edit / duplicate / delete per row. */
export function FoodLogList({
  entries,
  foods,
}: {
  entries: Array<FoodLog & { time: string }>;
  foods: Food[];
}) {
  const [editing, setEditing] = useState<FoodDialogEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [templateName, setTemplateName] = useState("");
  const { pending, run } = useAction();

  const toggle = (id: string) =>
    setSelected((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Entries</h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden /> Log food
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          title="Nothing logged today"
          description="Log a meal, or apply one of your saved meal templates."
          action={<Button size="sm" onClick={() => setCreating(true)}>Log food</Button>}
        />
      ) : (
        <div className="space-y-4">
          {MEAL_TYPES.filter((meal) => entries.some((entry) => entry.mealType === meal)).map(
            (meal) => (
              <Card key={meal} className="gap-0 p-0">
                <h3 className="border-b px-4 py-2.5 text-sm font-medium">{MEAL_LABEL[meal]}</h3>
                <ul className="divide-y">
                  {entries
                    .filter((entry) => entry.mealType === meal)
                    .map((entry) => (
                      <li
                        key={entry.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5"
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(entry.id)}
                          onChange={() => toggle(entry.id)}
                          aria-label={`Select ${entry.name} for a meal template`}
                          className="size-4 accent-foreground"
                        />
                        <div className="min-w-40 flex-1">
                          <p className="flex items-center gap-2 text-sm font-medium">
                            {entry.name}
                            {entry.source === "seed" ? (
                              <Badge variant="outline" className="text-[10px]">
                                Sample data
                              </Badge>
                            ) : null}
                          </p>
                          <p className="tabular text-xs text-muted-foreground">
                            {entry.time} · {formatValue(entry.quantity)} {entry.unit}
                            {entry.notes ? ` · ${entry.notes}` : ""}
                          </p>
                        </div>
                        <p className="tabular w-44 text-sm text-muted-foreground">
                          {formatValue(entry.calories)} kcal
                          {entry.proteinG !== null ? ` · ${formatValue(entry.proteinG)}p` : ""}
                          {entry.carbsG !== null ? ` · ${formatValue(entry.carbsG)}c` : ""}
                          {entry.fatG !== null ? ` · ${formatValue(entry.fatG)}f` : ""}
                        </p>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${entry.name}`}
                            onClick={() => setEditing(toDialogEntry(entry))}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={`Duplicate ${entry.name}`}
                            onClick={() =>
                              run(() => duplicateFoodLogAction(entry.id), {
                                success: "Entry duplicated",
                              })
                            }
                          >
                            <Copy className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={`Delete ${entry.name}`}
                            onClick={() =>
                              run(() => deleteFoodLogAction(entry.id), { success: "Entry deleted" })
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                </ul>
              </Card>
            ),
          )}
        </div>
      )}

      {selected.length > 0 ? (
        <Card className="gap-3 p-4">
          <h3 className="text-sm font-medium">
            Save {selected.length} {selected.length === 1 ? "entry" : "entries"} as a meal template
          </h3>
          <div className="flex flex-wrap gap-2">
            <Input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Breakfast oats"
              aria-label="Meal template name"
              className="max-w-xs"
            />
            <Button
              disabled={pending || templateName.trim() === ""}
              onClick={() =>
                run(
                  () =>
                    saveMealTemplateAction({
                      name: templateName.trim(),
                      mealType:
                        entries.find((entry) => entry.id === selected[0])?.mealType ?? "other",
                      logIds: selected,
                    }),
                  {
                    success: "Meal template saved",
                    onSuccess: () => {
                      setSelected([]);
                      setTemplateName("");
                    },
                  },
                )
              }
            >
              Save template
            </Button>
            <Button variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </Card>
      ) : null}

      <FoodDialog open={creating} onOpenChange={setCreating} foods={foods} />
      <FoodDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        entry={editing}
        foods={foods}
      />
    </div>
  );
}
