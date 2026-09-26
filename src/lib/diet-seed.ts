import type { MealType } from "./domain";

/**
 * The starting diet plan, as the user described it.
 *
 * Kept as plain data so both `scripts/seed.ts` (development) and
 * `scripts/seed-diet.ts` (a real deployment) write exactly the same plan, and
 * so editing it later is a data change rather than a code change. Nothing here
 * is applied automatically at runtime — a seed script has to be run, and it
 * refuses if the user already has a plan.
 */
export interface SeedOption {
  name: string;
  description?: string;
  ingredients: string[];
  calories?: number;
  proteinG?: number;
  isDefault?: boolean;
  notes?: string;
}

export interface SeedMeal {
  name: string;
  mealType: MealType;
  recommendedTime?: string;
  calorieTarget?: number;
  proteinTarget?: number;
  notes?: string;
  options: SeedOption[];
}

export interface SeedDietPlan {
  name: string;
  goal: string;
  calorieTarget: number;
  proteinTarget: number;
  notes: string;
  meals: SeedMeal[];
}

export const INITIAL_DIET_PLAN: SeedDietPlan = {
  name: "Lean Muscle Gain",
  goal: "Reach at least 57 kg while building lean muscle",
  calorieTarget: 2200,
  proteinTarget: 150,
  notes:
    "Whey: ATOM Whey Protein. Creatine: creatine monohydrate, 3–5 g daily. " +
    "Champaran chicken is being avoided for now while recurring stomach discomfort settles — " +
    "the oily, spicy preparation is a suspicion of the user's, not a diagnosis.",
  meals: [
    {
      name: "Breakfast",
      mealType: "breakfast",
      recommendedTime: "10:30-11:00",
      calorieTarget: 650,
      proteinTarget: 33,
      options: [
        {
          name: "Oats, milk and eggs",
          description: "The usual breakfast.",
          ingredients: [
            "70-80g oats",
            "300ml full-cream milk",
            "1 banana",
            "1 tbsp peanut butter",
            "2 eggs",
          ],
          calories: 700,
          proteinG: 33,
          isDefault: true,
        },
        {
          name: "Bread, eggs and milk",
          description: "When there is no time to cook oats.",
          ingredients: ["4 bread slices", "3 eggs", "250ml full-cream milk", "1 banana"],
          calories: 650,
          proteinG: 32,
        },
      ],
    },
    {
      name: "Lunch",
      mealType: "lunch",
      recommendedTime: "14:00-15:00",
      calorieTarget: 550,
      proteinTarget: 33,
      notes: "A normal home or office meal — no need for exact recipes.",
      options: [
        {
          name: "Roti, rice, dal and eggs",
          ingredients: ["3-4 roti", "rice", "dal / rajma / chhole", "2-3 eggs"],
          calories: 600,
          proteinG: 32,
          isDefault: true,
        },
        {
          name: "Roti, rice and paneer",
          description: "Or whatever protein is available that day.",
          ingredients: ["3-4 roti", "rice", "dal", "100g paneer"],
          calories: 600,
          proteinG: 30,
        },
      ],
    },
    {
      name: "Afternoon snack",
      mealType: "snack",
      recommendedTime: "17:00-17:30",
      calorieTarget: 275,
      proteinTarget: 13,
      options: [
        {
          name: "Roasted chana and banana",
          ingredients: ["50g roasted chana", "1 banana", "bread if still hungry", "tea or coffee"],
          calories: 290,
          proteinG: 13,
          isDefault: true,
        },
        {
          name: "Egg sandwich",
          ingredients: ["2 bread slices", "2 eggs"],
          calories: 280,
          proteinG: 15,
        },
      ],
    },
    {
      name: "Pre-workout",
      mealType: "snack",
      recommendedTime: "60-90 min before training",
      calorieTarget: 250,
      proteinTarget: 15,
      notes: "Optional — skip it when the workout is close to another meal.",
      options: [
        {
          name: "Bread and eggs",
          ingredients: ["2 bread slices", "2 eggs"],
          calories: 280,
          proteinG: 16,
          isDefault: true,
        },
        {
          name: "Banana and milk",
          ingredients: ["1 banana", "250ml full-cream milk"],
          calories: 260,
          proteinG: 9,
        },
      ],
    },
    {
      name: "Dinner",
      mealType: "dinner",
      recommendedTime: "21:00-22:00",
      calorieTarget: 650,
      proteinTarget: 40,
      notes: "A rotation, not a fixed meal. Champaran chicken is off the list for now.",
      options: [
        {
          name: "Egg bhurji",
          ingredients: ["4 eggs", "3-4 roti", "rice if needed", "simple sabzi"],
          calories: 700,
          proteinG: 34,
          isDefault: true,
        },
        {
          name: "Chicken with rice or roti",
          description: "Plain, grilled or tandoori.",
          ingredients: ["150-200g chicken", "rice and/or roti"],
          calories: 680,
          proteinG: 50,
        },
        {
          name: "Soya chunks with rice or roti",
          ingredients: ["60g dry soya chunks", "rice and/or roti"],
          calories: 620,
          proteinG: 40,
        },
        {
          name: "Egg curry, dal and rice",
          ingredients: ["2-3 eggs", "dal", "rice"],
          calories: 650,
          proteinG: 30,
        },
        {
          name: "Paneer bhurji",
          ingredients: ["120-150g paneer", "roti"],
          calories: 660,
          proteinG: 32,
        },
      ],
    },
    {
      name: "Post-workout",
      mealType: "snack",
      recommendedTime: "within 30 min of training",
      calorieTarget: 200,
      proteinTarget: 25,
      notes: "Take the high-calorie version only when the day is behind on calories or protein.",
      options: [
        {
          name: "Normal shake",
          description: "The default after every session.",
          ingredients: ["1 scoop ATOM whey", "250-300ml water", "3-5g creatine monohydrate"],
          calories: 130,
          proteinG: 25,
          isDefault: true,
        },
        {
          name: "High-calorie shake",
          description: "Only when calories or protein are behind for the day.",
          ingredients: [
            "300ml milk",
            "1 scoop ATOM whey",
            "1 banana",
            "40-50g oats",
            "3-5g creatine monohydrate",
          ],
          calories: 600,
          proteinG: 40,
        },
      ],
    },
  ],
};
