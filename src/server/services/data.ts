import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  applications,
  bills,
  foodLogs,
  foods,
  goalEntries,
  goals,
  mealTemplateItems,
  mealTemplates,
  moneyAccounts,
  notes,
  profiles,
  routines,
  sleepEntries,
  tasks,
  timeBlocks,
  timeEntries,
  transactions,
  waterLogs,
  weightEntries,
  workoutExercises,
  workoutSets,
  workoutTemplateExercises,
  workoutTemplates,
  workouts,
} from "@/db/schema";
import { getHistory } from "./summary";
import { addDays, toLocalDate, type LocalDate } from "@/lib/date";

export const EXPORT_VERSION = 2;

/** A complete, portable copy of one user's data. */
export interface ExportBundle {
  version: number;
  exportedAt: string;
  profile: unknown;
  goals: unknown[];
  goalEntries: unknown[];
  foods: unknown[];
  foodLogs: unknown[];
  mealTemplates: unknown[];
  waterLogs: unknown[];
  weightEntries: unknown[];
  sleepEntries: unknown[];
  workouts: unknown[];
  workoutTemplates: unknown[];
  notes: unknown[];
  tasks: unknown[];
  timeEntries: unknown[];
  applications: unknown[];
  routines: unknown[];
  timeBlocks: unknown[];
  moneyAccounts: unknown[];
  transactions: unknown[];
  bills: unknown[];
}

export async function exportData(userId: string): Promise<ExportBundle> {
  const [
    profile,
    goalRows,
    goalEntryRows,
    foodRows,
    foodLogRows,
    mealTemplateRows,
    waterRows,
    weightRows,
    sleepRows,
    workoutRows,
    workoutTemplateRows,
    noteRows,
    taskRows,
    timeRows,
    applicationRows,
    routineRows,
    blockRows,
    accountRows,
    transactionRows,
    billRows,
  ] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
    db.select().from(goals).where(eq(goals.userId, userId)),
    db.select().from(goalEntries).where(eq(goalEntries.userId, userId)),
    db.select().from(foods).where(eq(foods.userId, userId)),
    db.select().from(foodLogs).where(eq(foodLogs.userId, userId)),
    db.query.mealTemplates.findMany({
      where: eq(mealTemplates.userId, userId),
      with: { items: true },
    }),
    db.select().from(waterLogs).where(eq(waterLogs.userId, userId)),
    db.select().from(weightEntries).where(eq(weightEntries.userId, userId)),
    db.select().from(sleepEntries).where(eq(sleepEntries.userId, userId)),
    db.query.workouts.findMany({
      where: eq(workouts.userId, userId),
      with: { exercises: { with: { sets: true } } },
    }),
    db.query.workoutTemplates.findMany({
      where: eq(workoutTemplates.userId, userId),
      with: { exercises: true },
    }),
    db.select().from(notes).where(eq(notes.userId, userId)),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
    db.select().from(timeEntries).where(eq(timeEntries.userId, userId)),
    db.select().from(applications).where(eq(applications.userId, userId)),
    db.select().from(routines).where(eq(routines.userId, userId)),
    db.select().from(timeBlocks).where(eq(timeBlocks.userId, userId)),
    db.select().from(moneyAccounts).where(eq(moneyAccounts.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(bills).where(eq(bills.userId, userId)),
  ]);

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    profile: profile ?? null,
    goals: goalRows,
    goalEntries: goalEntryRows,
    foods: foodRows,
    foodLogs: foodLogRows,
    mealTemplates: mealTemplateRows,
    waterLogs: waterRows,
    weightEntries: weightRows,
    sleepEntries: sleepRows,
    workouts: workoutRows,
    workoutTemplates: workoutTemplateRows,
    notes: noteRows,
    tasks: taskRows,
    timeEntries: timeRows,
    applications: applicationRows,
    routines: routineRows,
    timeBlocks: blockRows,
    moneyAccounts: accountRows,
    transactions: transactionRows,
    bills: billRows,
  };
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Daily summary CSV — the shape most useful in a spreadsheet. */
export async function exportDailyCsv(
  userId: string,
  timezone: string,
  days = 365,
): Promise<string> {
  const today = toLocalDate(new Date(), timezone);
  const history = await getHistory(userId, addDays(today, -(days - 1)), today);
  const header = [
    "date",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "water_ml",
    "sleep_hours",
    "workouts",
    "weight_kg",
  ];
  const rows = history.map((day) =>
    [
      day.date,
      day.calories,
      day.protein,
      day.carbs,
      day.fat,
      day.waterMl,
      day.sleepHours,
      day.workoutCount,
      day.weightKg,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/**
 * Import accepts a bundle produced by `exportData`. Rows are re-keyed to the
 * importing user so a bundle can never be used to write into another account.
 */
const importSchema = z.object({
  version: z.number().int().min(1).max(EXPORT_VERSION),
  goals: z.array(z.record(z.string(), z.unknown())).default([]),
  goalEntries: z.array(z.record(z.string(), z.unknown())).default([]),
  foods: z.array(z.record(z.string(), z.unknown())).default([]),
  foodLogs: z.array(z.record(z.string(), z.unknown())).default([]),
  waterLogs: z.array(z.record(z.string(), z.unknown())).default([]),
  weightEntries: z.array(z.record(z.string(), z.unknown())).default([]),
  sleepEntries: z.array(z.record(z.string(), z.unknown())).default([]),
  notes: z.array(z.record(z.string(), z.unknown())).default([]),
  tasks: z.array(z.record(z.string(), z.unknown())).default([]),
  timeEntries: z.array(z.record(z.string(), z.unknown())).default([]),
  applications: z.array(z.record(z.string(), z.unknown())).default([]),
  routines: z.array(z.record(z.string(), z.unknown())).default([]),
  moneyAccounts: z.array(z.record(z.string(), z.unknown())).default([]),
  transactions: z.array(z.record(z.string(), z.unknown())).default([]),
  bills: z.array(z.record(z.string(), z.unknown())).default([]),
});

export interface ImportReport {
  goals: number;
  foodLogs: number;
  waterLogs: number;
  weightEntries: number;
  sleepEntries: number;
  notes: number;
  tasks: number;
  timeEntries: number;
  applications: number;
  routines: number;
  transactions: number;
  bills: number;
}

type Row = Record<string, unknown>;

const str = (row: Row, key: string): string | null =>
  typeof row[key] === "string" ? (row[key] as string) : null;
const num = (row: Row, key: string): number | null =>
  typeof row[key] === "number" && Number.isFinite(row[key]) ? (row[key] as number) : null;
const date = (row: Row, key: string): Date | null => {
  const value = row[key];
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export async function importData(userId: string, payload: unknown): Promise<ImportReport> {
  const bundle = importSchema.parse(payload);
  const report: ImportReport = {
    goals: 0,
    foodLogs: 0,
    waterLogs: 0,
    weightEntries: 0,
    sleepEntries: 0,
    notes: 0,
    tasks: 0,
    timeEntries: 0,
    applications: 0,
    routines: 0,
    transactions: 0,
    bills: 0,
  };

  await db.transaction(async (tx) => {
    const goalIdMap = new Map<string, string>();

    for (const row of bundle.goals) {
      const name = str(row, "name");
      const type = str(row, "type");
      const period = str(row, "period");
      if (!name || !type || !period) continue;
      const [created] = await tx
        .insert(goals)
        .values({
          userId,
          name,
          description: str(row, "description"),
          type: type as never,
          unit: str(row, "unit"),
          targetValue: num(row, "targetValue"),
          period: period as never,
          metricKey: (str(row, "metricKey") ?? null) as never,
          sortOrder: num(row, "sortOrder") ?? 0,
          visibleOnDashboard: row.visibleOnDashboard !== false,
          showInChecklist: row.showInChecklist !== false,
          active: row.active !== false,
        })
        .returning({ id: goals.id });
      const originalId = str(row, "id");
      if (originalId) goalIdMap.set(originalId, created.id);
      report.goals += 1;
    }

    for (const row of bundle.goalEntries) {
      const originalGoalId = str(row, "goalId");
      const localDate = str(row, "localDate");
      const mapped = originalGoalId ? goalIdMap.get(originalGoalId) : undefined;
      if (!mapped || !localDate) continue;
      await tx.insert(goalEntries).values({
        userId,
        goalId: mapped,
        localDate,
        value: num(row, "value") ?? 1,
        note: str(row, "note"),
        occurredAt: date(row, "occurredAt") ?? new Date(),
      });
    }

    for (const row of bundle.foods) {
      const name = str(row, "name");
      if (!name) continue;
      await tx
        .insert(foods)
        .values({
          userId,
          name,
          calories: num(row, "calories") ?? 0,
          proteinG: num(row, "proteinG"),
          carbsG: num(row, "carbsG"),
          fatG: num(row, "fatG"),
          servingQuantity: num(row, "servingQuantity") ?? 1,
          servingUnit: str(row, "servingUnit") ?? "serving",
        })
        .onConflictDoNothing();
    }

    for (const row of bundle.foodLogs) {
      const name = str(row, "name");
      const localDate = str(row, "localDate");
      if (!name || !localDate) continue;
      await tx.insert(foodLogs).values({
        userId,
        name,
        calories: num(row, "calories") ?? 0,
        proteinG: num(row, "proteinG"),
        carbsG: num(row, "carbsG"),
        fatG: num(row, "fatG"),
        quantity: num(row, "quantity") ?? 1,
        unit: str(row, "unit") ?? "serving",
        mealType: (str(row, "mealType") ?? "other") as never,
        notes: str(row, "notes"),
        occurredAt: date(row, "occurredAt") ?? new Date(`${localDate}T12:00:00Z`),
        localDate,
      });
      report.foodLogs += 1;
    }

    for (const row of bundle.waterLogs) {
      const localDate = str(row, "localDate");
      const milliliters = num(row, "milliliters");
      if (!localDate || milliliters === null) continue;
      await tx.insert(waterLogs).values({
        userId,
        milliliters: Math.round(milliliters),
        occurredAt: date(row, "occurredAt") ?? new Date(`${localDate}T12:00:00Z`),
        localDate,
      });
      report.waterLogs += 1;
    }

    for (const row of bundle.weightEntries) {
      const localDate = str(row, "localDate");
      const weightKg = num(row, "weightKg");
      if (!localDate || weightKg === null) continue;
      await tx.insert(weightEntries).values({
        userId,
        weightKg,
        note: str(row, "note"),
        occurredAt: date(row, "occurredAt") ?? new Date(`${localDate}T07:00:00Z`),
        localDate,
      });
      report.weightEntries += 1;
    }

    for (const row of bundle.sleepEntries) {
      const startAt = date(row, "startAt");
      const endAt = date(row, "endAt");
      const localDate = str(row, "localDate");
      if (!startAt || !endAt || !localDate) continue;
      await tx.insert(sleepEntries).values({
        userId,
        startAt,
        endAt,
        localDate,
        quality: num(row, "quality"),
        note: str(row, "note"),
      });
      report.sleepEntries += 1;
    }

    for (const row of bundle.notes) {
      const body = str(row, "body");
      const localDate = str(row, "localDate");
      if (!body || !localDate) continue;
      await tx.insert(notes).values({ userId, body, localDate });
      report.notes += 1;
    }

    for (const row of bundle.tasks) {
      const title = str(row, "title");
      if (!title) continue;
      await tx.insert(tasks).values({
        userId,
        title,
        area: str(row, "area") as never,
        dueDate: str(row, "dueDate"),
        priority: (str(row, "priority") ?? "medium") as never,
        status: (str(row, "status") ?? "todo") as never,
        completedAt: date(row, "completedAt"),
        completedOn: str(row, "completedOn"),
        notes: str(row, "notes"),
      });
      report.tasks += 1;
    }

    for (const row of bundle.timeEntries) {
      const category = str(row, "category");
      const startAt = date(row, "startAt");
      const localDate = str(row, "localDate");
      if (!category || !startAt || !localDate) continue;
      await tx.insert(timeEntries).values({
        userId,
        category: category as never,
        label: str(row, "label"),
        startAt,
        endAt: date(row, "endAt"),
        durationMinutes: num(row, "durationMinutes"),
        localDate,
        notes: str(row, "notes"),
      });
      report.timeEntries += 1;
    }

    for (const row of bundle.applications) {
      const company = str(row, "company");
      const role = str(row, "role");
      if (!company || !role) continue;
      await tx.insert(applications).values({
        userId,
        company,
        role,
        stage: (str(row, "stage") ?? "wishlist") as never,
        url: str(row, "url"),
        location: str(row, "location"),
        salaryNote: str(row, "salaryNote"),
        nextStep: str(row, "nextStep"),
        nextStepDate: str(row, "nextStepDate"),
        appliedOn: str(row, "appliedOn"),
        notes: str(row, "notes"),
        archivedAt: date(row, "archivedAt"),
      });
      report.applications += 1;
    }

    for (const row of bundle.routines) {
      const label = str(row, "label");
      const startTime = str(row, "startTime");
      const endTime = str(row, "endTime");
      const weekdays = num(row, "weekdays");
      if (!label || !startTime || !endTime || weekdays === null) continue;
      await tx.insert(routines).values({
        userId,
        label,
        kind: (str(row, "kind") ?? "routine") as never,
        area: str(row, "area") as never,
        startTime,
        endTime,
        weekdays: Math.round(weekdays),
        active: row.active !== false,
      });
      report.routines += 1;
    }

    const accountIdMap = new Map<string, string>();
    for (const row of bundle.moneyAccounts) {
      const name = str(row, "name");
      if (!name) continue;
      const [created] = await tx
        .insert(moneyAccounts)
        .values({
          userId,
          name,
          kind: (str(row, "kind") ?? "bank") as never,
          balance: num(row, "balance") ?? 0,
          creditLimit: num(row, "creditLimit"),
          statementDay: num(row, "statementDay"),
          dueDay: num(row, "dueDay"),
          currency: str(row, "currency") ?? "INR",
        })
        .onConflictDoUpdate({
          target: [moneyAccounts.userId, moneyAccounts.name],
          set: { balance: num(row, "balance") ?? 0 },
        })
        .returning({ id: moneyAccounts.id });
      const originalId = str(row, "id");
      if (originalId) accountIdMap.set(originalId, created.id);
    }

    // Balances are imported as stated above; transactions are history only.
    for (const row of bundle.transactions) {
      const amount = num(row, "amount");
      const localDate = str(row, "localDate");
      if (amount === null || !localDate) continue;
      const originalAccount = str(row, "accountId");
      await tx.insert(transactions).values({
        userId,
        accountId: originalAccount ? (accountIdMap.get(originalAccount) ?? null) : null,
        amount,
        kind: (str(row, "kind") ?? "expense") as never,
        category: (str(row, "category") ?? "other") as never,
        label: str(row, "label"),
        occurredAt: date(row, "occurredAt") ?? new Date(`${localDate}T12:00:00Z`),
        localDate,
        notes: str(row, "notes"),
      });
      report.transactions += 1;
    }

    for (const row of bundle.bills) {
      const name = str(row, "name");
      const amount = num(row, "amount");
      const dueDate = str(row, "dueDate");
      if (!name || amount === null || !dueDate) continue;
      await tx.insert(bills).values({
        userId,
        name,
        amount,
        dueDate,
        recurrence: (str(row, "recurrence") ?? "none") as never,
        category: (str(row, "category") ?? "bills") as never,
        status: (str(row, "status") ?? "pending") as never,
        notes: str(row, "notes"),
      });
      report.bills += 1;
    }
  });

  return report;
}

/** Removes every record owned by the user. The account itself stays. */
export async function deleteAllData(userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const templateIds = await tx
      .select({ id: mealTemplates.id })
      .from(mealTemplates)
      .where(eq(mealTemplates.userId, userId));
    for (const { id } of templateIds) {
      await tx.delete(mealTemplateItems).where(eq(mealTemplateItems.templateId, id));
    }
    const workoutIds = await tx
      .select({ id: workouts.id })
      .from(workouts)
      .where(eq(workouts.userId, userId));
    for (const { id } of workoutIds) {
      const exerciseIds = await tx
        .select({ id: workoutExercises.id })
        .from(workoutExercises)
        .where(eq(workoutExercises.workoutId, id));
      for (const exercise of exerciseIds) {
        await tx.delete(workoutSets).where(eq(workoutSets.exerciseId, exercise.id));
      }
      await tx.delete(workoutExercises).where(eq(workoutExercises.workoutId, id));
    }
    const workoutTemplateIds = await tx
      .select({ id: workoutTemplates.id })
      .from(workoutTemplates)
      .where(eq(workoutTemplates.userId, userId));
    for (const { id } of workoutTemplateIds) {
      await tx
        .delete(workoutTemplateExercises)
        .where(eq(workoutTemplateExercises.templateId, id));
    }

    await tx.delete(timeBlocks).where(eq(timeBlocks.userId, userId));
    await tx.delete(routines).where(eq(routines.userId, userId));
    await tx.delete(tasks).where(eq(tasks.userId, userId));
    await tx.delete(timeEntries).where(eq(timeEntries.userId, userId));
    await tx.delete(applications).where(eq(applications.userId, userId));
    await tx.delete(bills).where(eq(bills.userId, userId));
    await tx.delete(transactions).where(eq(transactions.userId, userId));
    await tx.delete(moneyAccounts).where(eq(moneyAccounts.userId, userId));
    await tx.delete(workouts).where(eq(workouts.userId, userId));
    await tx.delete(workoutTemplates).where(eq(workoutTemplates.userId, userId));
    await tx.delete(mealTemplates).where(eq(mealTemplates.userId, userId));
    await tx.delete(goalEntries).where(eq(goalEntries.userId, userId));
    await tx.delete(goals).where(eq(goals.userId, userId));
    await tx.delete(foodLogs).where(eq(foodLogs.userId, userId));
    await tx.delete(foods).where(eq(foods.userId, userId));
    await tx.delete(waterLogs).where(eq(waterLogs.userId, userId));
    await tx.delete(weightEntries).where(eq(weightEntries.userId, userId));
    await tx.delete(sleepEntries).where(eq(sleepEntries.userId, userId));
    await tx.delete(notes).where(eq(notes.userId, userId));
  });
}

export type { LocalDate };
