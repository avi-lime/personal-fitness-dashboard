/**
 * Asks the configured model for one structured estimate, from the terminal.
 *
 *   npm run assistant:estimate -- food "masala dosa with sambar" 1 serving
 *   npm run assistant:estimate -- expense "auto to office" 80
 *   npm run assistant:estimate -- task "prepare for the design round by friday"
 *
 * Read-only: nothing is written to the database.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  const [{ createAssistantClient, assistantModel, isAssistantConfigured }, { runEstimate }, { toLocalDate }] =
    await Promise.all([
      import("../src/assistant/client"),
      import("../src/assistant/estimate"),
      import("../src/lib/date"),
    ]);
  if (!isAssistantConfigured()) throw new Error("ASSISTANT_API_KEY is not set.");

  const timezone = process.env.SEED_TIMEZONE ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const ctx = { today: toLocalDate(new Date(), timezone), timezone, currency: "INR" };
  const client = createAssistantClient();
  const model = assistantModel();

  const request = (() => {
    switch (mode) {
      case "food":
        return {
          kind: "food_macros" as const,
          input: { name: rest[0], quantity: rest[1] ? Number(rest[1]) : 1, unit: rest[2] ?? "serving" },
        };
      case "expense":
        return { kind: "expense_category" as const, input: { label: rest[0], amount: rest[1] ? Number(rest[1]) : undefined } };
      case "task":
        return { kind: "task_fields" as const, input: { title: rest.join(" ") } };
      default:
        throw new Error('Usage: npm run assistant:estimate -- food|expense|task "…"');
    }
  })();

  const started = Date.now();
  const result = await runEstimate(request.kind, request.input, ctx, client, model);
  console.log(`${request.kind} via ${model} (${Date.now() - started} ms)`);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(async (error) => {
  const { describeAssistantError } = await import("../src/assistant/client");
  console.error(describeAssistantError(error));
  process.exit(1);
});
