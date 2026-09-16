/**
 * Domain vocabulary shared by the database schema, the pure calculation layer,
 * the UI and the MCP server. Keeping these here (rather than in the Drizzle
 * schema) lets the calculation modules stay free of any database import.
 */

export const GOAL_TYPES = ["numeric", "duration", "boolean", "count"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];

export const GOAL_PERIODS = ["daily", "weekly", "monthly", "one_time"] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];

export const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack", "other"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const ENTRY_SOURCES = ["web", "mcp", "assistant", "seed"] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const UNIT_SYSTEMS = ["metric", "imperial"] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/**
 * Metrics that the app can derive automatically from logged events.
 * A goal with `metricKey === null` is a *manual* goal: its progress comes from
 * explicit goal entries instead.
 *
 * To add a new automatic metric see `src/lib/metrics.ts` (single registry) and
 * the "Adding a goal type or metric" section of the README.
 */
export const METRIC_KEYS = [
  "calories",
  "protein",
  "carbs",
  "fat",
  "water_ml",
  "sleep_hours",
  "workouts",
  "body_weight_kg",
  "time_minutes",
  "tasks_completed",
  "applications_sent",
  "spend",
  "income",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

/**
 * Life areas. A closed list rather than a table: the assistant's tool schemas
 * become a strict enum, which small models get right far more often than a
 * free string that has to match a user-defined row. Adding one is a one-line
 * edit here plus a label below.
 */
export const AREA_KEYS = [
  "fitness",
  "nutrition",
  "work",
  "freelance",
  "career",
  "study",
  "money",
  "personal",
] as const;
export type AreaKey = (typeof AREA_KEYS)[number];

export const AREA_LABELS: Record<AreaKey, string> = {
  fitness: "Fitness",
  nutrition: "Nutrition",
  work: "Work",
  freelance: "Freelance",
  career: "Career",
  study: "Study",
  money: "Money",
  personal: "Personal",
};

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["todo", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Job-search pipeline stages, in order. */
export const APPLICATION_STAGES = [
  "wishlist",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  wishlist: "Wishlist",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

/** Spending categories — closed for the same reason as areas. */
export const EXPENSE_CATEGORIES = [
  "food",
  "transport",
  "rent",
  "utilities",
  "shopping",
  "health",
  "entertainment",
  "subscriptions",
  "education",
  "bills",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: "Food",
  transport: "Transport",
  rent: "Rent",
  utilities: "Utilities",
  shopping: "Shopping",
  health: "Health",
  entertainment: "Entertainment",
  subscriptions: "Subscriptions",
  education: "Education",
  bills: "Bills",
  other: "Other",
};

export const ACCOUNT_KINDS = ["bank", "cash", "credit_card", "wallet"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  bank: "Bank",
  cash: "Cash",
  credit_card: "Credit card",
  wallet: "Wallet",
};

/**
 * expense/payment reduce available money (or grow what a card owes);
 * income adds; transfer moves between accounts (paying a card is a transfer).
 */
export const TRANSACTION_KINDS = ["expense", "income", "transfer", "payment"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const BILL_RECURRENCES = ["none", "monthly"] as const;
export type BillRecurrence = (typeof BILL_RECURRENCES)[number];

export const BILL_STATUSES = ["pending", "paid"] as const;
export type BillStatus = (typeof BILL_STATUSES)[number];

/** What a planned block of the day is for. */
export const BLOCK_KINDS = ["routine", "task", "meal", "workout", "study", "other"] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const GOAL_STATUSES = ["not_started", "in_progress", "complete"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

/** The dashboard sections a user can show or hide. */
export const DASHBOARD_SECTIONS = [
  "nextAction",
  "today",
  "quickActions",
  "training",
  "body",
  "weekly",
  "notes",
] as const;
export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

export type DashboardSectionVisibility = Record<DashboardSection, boolean>;

export const DEFAULT_DASHBOARD_SECTIONS: DashboardSectionVisibility = {
  nextAction: true,
  today: true,
  quickActions: true,
  training: true,
  body: true,
  weekly: true,
  notes: true,
};
