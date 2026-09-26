/** Sent to clients during initialization; shapes how a model should use this server. */
export const SERVER_INSTRUCTIONS = `This server controls one person's private life dashboard: goals, food, water, weight, sleep, workouts, notes, tasks, time tracking (study, freelance, work, career…), a job-application pipeline, a planned day made of time blocks and routines, money (accounts, expenses, income, bills), and a diet plan.

Read tools (get_*) are safe to call whenever you need context; they never change anything.

Write tools (log_*, add_*, update_*, remove_*, complete_*) modify persistent personal records. Use them only when the user clearly intends the change, and prefer calling a read tool first to check the current state before making an ambiguous or destructive modification.

Rules of thumb:
- Food: if the user gives calories or macros, use exactly those. If they only name the food, log typical values for that food and quantity with estimated:true and say it is an estimate — the user prefers a marked estimate over being asked. Never present an estimate as a measurement.
- Dates are calendar days in the user's own timezone, formatted YYYY-MM-DD. Timestamps are ISO-8601. Omit an optional date or timestamp to mean "now"/"today".
- Goals are fully user-defined. Never assume a goal exists: call get_goals first. A goal tracked from a metric (for example protein) updates automatically from logged entries — do not use complete_goal for those; log the underlying entry instead.
- remove_goal archives a goal and hides it from the dashboard; historical entries are kept. It is not reversible from this server, so confirm with the user first.
- Tasks are things still to do; use complete_task when one is finished and log_time / start_timer for time spent. "I studied for an hour" is log_time, not a task.
- Life areas are a fixed list: fitness, nutrition, work, freelance, career, study, money, personal.
- "Plan my day" means plan_day (routines → blocks); then add_block for one-off items the user mentions. Times are HH:MM in the user's timezone.
- Job applications move through wishlist → applied → screening → interview → offer / rejected via update_application; archive only when the user wants it gone.
- Diet plan vs food log: get_diet_plan is what the user PLANS to eat (meals, each with a default option and alternatives); get_food_log is what they actually ate. "What should I have for dinner?" and "change my dinner options" are the plan; "I had egg bhurji" is log_food. Editing the plan never logs food, and logging food never changes the plan. Call get_diet_plan before editing it, and identify meals and options by name — the tools match loosely. Removing an option disables it rather than deleting it, so it can be restored.
- Diet targets vs goals: the plan's calorie/protein targets are what its meals were designed around; goals are what progress is scored against. Changing one does not change the other — if the user wants both, say so and use update_diet_plan and update_goal.
- Money: "I spent 250 on lunch" is log_expense (category food). Amounts are in the user's currency. A bill that was paid is pay_bill; paying off a credit card is a transfer, not spending. Never invent amounts.
- Ask for clarification rather than guessing when a mutation is ambiguous.`;
