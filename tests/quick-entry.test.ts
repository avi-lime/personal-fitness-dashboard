import { describe, expect, it } from "vitest";
import { describeIntent, parseQuickEntry } from "@/lib/quick-entry";

describe("quick entry parsing", () => {
  it("parses water in millilitres and litres", () => {
    expect(parseQuickEntry("+500 ml water")).toEqual({ kind: "water", milliliters: 500 });
    expect(parseQuickEntry("500ml")).toEqual({ kind: "water", milliliters: 500 });
    expect(parseQuickEntry("water 250")).toEqual({ kind: "water", milliliters: 250 });
    expect(parseQuickEntry("+0.5 l water")).toEqual({ kind: "water", milliliters: 500 });
  });

  it("parses protein", () => {
    expect(parseQuickEntry("+25 g protein")).toEqual({ kind: "protein", grams: 25 });
    expect(parseQuickEntry("protein 30")).toEqual({ kind: "protein", grams: 30 });
  });

  it("parses calories with an optional meal and label", () => {
    expect(parseQuickEntry("log 450 kcal lunch")).toEqual({
      kind: "food",
      name: "lunch",
      calories: 450,
      protein: null,
      mealType: "lunch",
    });
    expect(parseQuickEntry("+450 kcal")).toEqual({
      kind: "food",
      name: "Quick entry",
      calories: 450,
      protein: null,
      mealType: null,
    });
  });

  it("parses weight", () => {
    expect(parseQuickEntry("weigh 50.4 kg")).toEqual({ kind: "weight", kilograms: 50.4 });
    expect(parseQuickEntry("weight 50,4")).toEqual({ kind: "weight", kilograms: 50.4 });
    expect(parseQuickEntry("50.4 kg")).toEqual({ kind: "weight", kilograms: 50.4 });
  });

  it("parses sleep in hours or minutes", () => {
    expect(parseQuickEntry("slept 7.5h")).toEqual({ kind: "sleep", hours: 7.5 });
    expect(parseQuickEntry("sleep 450 min")).toEqual({ kind: "sleep", hours: 7.5 });
  });

  it("parses workouts and notes", () => {
    expect(parseQuickEntry("workout complete")).toEqual({ kind: "workout", name: "Workout" });
    expect(parseQuickEntry("log workout Push day")).toEqual({
      kind: "workout",
      name: "Push day",
    });
    expect(parseQuickEntry("note felt strong today")).toEqual({
      kind: "note",
      text: "felt strong today",
    });
  });

  it("rejects nonsense and impossible values", () => {
    expect(parseQuickEntry("")).toBeNull();
    expect(parseQuickEntry("hello there")).toBeNull();
    expect(parseQuickEntry("weigh 900 kg")).toBeNull();
    expect(parseQuickEntry("+99999 ml water")).toBeNull();
    expect(parseQuickEntry("slept 30h")).toBeNull();
  });

  it("describes what it will do", () => {
    const intent = parseQuickEntry("+500 ml water");
    expect(intent && describeIntent(intent)).toBe("Log 500 ml of water");
  });
});
