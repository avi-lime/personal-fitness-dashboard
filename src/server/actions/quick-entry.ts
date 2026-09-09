"use server";

import { z } from "zod";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { describeIntent, parseQuickEntry } from "@/lib/quick-entry";
import { logFood } from "@/server/services/food";
import { logWater } from "@/server/services/water";
import { logSleep, logWeight } from "@/server/services/body";
import { addNote } from "@/server/services/notes";
import { createWorkout, setWorkoutCompletion } from "@/server/services/workouts";
import { revalidateAll, withValidation } from "./helpers";

/**
 * Runs a single line of quick-entry text. Parsing is pure (`lib/quick-entry`);
 * this action only dispatches the resulting intent to the right service.
 */
export async function runQuickEntryAction(raw: string): Promise<ActionResult<{ message: string }>> {
  return withValidation(z.string().min(1).max(200), raw, async (value, ctx) => {
    const intent = parseQuickEntry(value);
    if (!intent) return fail(`Could not understand "${value.trim()}"`);

    const { user, timezone } = ctx;
    switch (intent.kind) {
      case "water":
        await logWater(user.id, timezone, intent.milliliters);
        break;
      case "protein":
        await logFood(user.id, timezone, {
          name: "Protein",
          calories: 0,
          proteinG: intent.grams,
          quantity: 1,
          unit: "serving",
          mealType: "other",
        });
        break;
      case "food":
        await logFood(user.id, timezone, {
          name: intent.name,
          calories: intent.calories,
          proteinG: intent.protein,
          quantity: 1,
          unit: "serving",
          mealType: intent.mealType ?? "other",
        });
        break;
      case "weight":
        await logWeight(user.id, timezone, intent.kilograms);
        break;
      case "sleep": {
        const end = new Date();
        const start = new Date(end.getTime() - intent.hours * 3_600_000);
        await logSleep(user.id, timezone, {
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        });
        break;
      }
      case "workout": {
        const workout = await createWorkout(user.id, timezone, { name: intent.name });
        await setWorkoutCompletion(user.id, workout.id, true);
        break;
      }
      case "note":
        await addNote(user.id, timezone, intent.text);
        break;
    }

    revalidateAll();
    return ok({ message: describeIntent(intent) });
  });
}
