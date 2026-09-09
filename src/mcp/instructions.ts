/** Sent to clients during initialization; shapes how a model should use this server. */
export const SERVER_INSTRUCTIONS = `This server controls one person's private life/fitness dashboard (goals, food, water, weight, sleep, workouts and notes).

Read tools (get_*) are safe to call whenever you need context; they never change anything.

Write tools (log_*, add_*, update_*, remove_*, complete_*) modify persistent personal records. Use them only when the user clearly intends the change, and prefer calling a read tool first to check the current state before making an ambiguous or destructive modification.

Rules of thumb:
- Do not invent food or macronutrient values. If exact calories or macros are unknown, ask the user rather than estimating. Calories are required when logging food; protein, carbs and fat may be omitted.
- Dates are calendar days in the user's own timezone, formatted YYYY-MM-DD. Timestamps are ISO-8601. Omit an optional date or timestamp to mean "now"/"today".
- Goals are fully user-defined. Never assume a goal exists: call get_goals first. A goal tracked from a metric (for example protein) updates automatically from logged entries — do not use complete_goal for those; log the underlying entry instead.
- remove_goal archives a goal and hides it from the dashboard; historical entries are kept. It is not reversible from this server, so confirm with the user first.
- Ask for clarification rather than guessing when a mutation is ambiguous.`;
