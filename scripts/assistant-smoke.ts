/**
 * Runs one assistant request against the configured provider, as the owner.
 * Useful for checking a new API key or model without the browser.
 *
 *   npm run assistant:smoke -- "log 500 ml water"
 *
 * It performs real writes (tagged source "assistant") — this is a smoke test,
 * not a dry run.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  const input = process.argv.slice(2).join(" ").trim();
  if (!input) throw new Error('Usage: npm run assistant:smoke -- "log 500 ml water"');

  // Imported after dotenv so the env validator sees the values.
  const [{ ensureOwnerUser, getProfileFor }, { contextForUser }, { TOOLS }, client, digest, prompt, runner] =
    await Promise.all([
      import("../src/server/services/profile"),
      import("../src/mcp/context"),
      import("../src/mcp/registry"),
      import("../src/assistant/client"),
      import("../src/assistant/digest"),
      import("../src/assistant/prompt"),
      import("../src/assistant/runner"),
    ]);

  if (!client.isAssistantConfigured()) throw new Error("ASSISTANT_API_KEY is not set.");

  const user = await ensureOwnerUser();
  const [ctx, profile] = await Promise.all([
    contextForUser(user.id, "assistant"),
    getProfileFor(user.id),
  ]);
  const started = Date.now();
  const response = await runner.runAssistant({
    client: client.createAssistantClient(),
    model: client.assistantModel(),
    tools: TOOLS,
    ctx,
    systemPrompt: prompt.buildSystemPrompt({
      ctx,
      currency: profile.currency,
      digest: await digest.buildDigest(ctx),
    }),
    history: [],
    input,
  });

  console.log(`model: ${client.assistantModel()}  (${Date.now() - started} ms)`);
  console.log(`understood: ${response.understood}`);
  console.log(`reply: ${response.reply}`);
  for (const action of response.actions) console.log(`  ✓ ${action.tool}: ${action.summary}`);
  if (response.pending) console.log(`  ? pending ${response.pending.tool}: ${response.pending.summary}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
