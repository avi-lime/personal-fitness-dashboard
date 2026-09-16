import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/server/auth";
import { contextForUser } from "@/mcp/context";
import { toolByName } from "@/mcp/registry";
import { ToolFailure } from "@/mcp/tools/write";
import { describeError } from "@/lib/errors";
import { formatZodError } from "@/lib/validation";
import type { AssistantResponse } from "@/assistant/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  tool: z.string().min(1).max(80),
  args: z.record(z.string(), z.unknown()).default({}),
});

/**
 * Runs one NON-destructive tool the user clicked in the app (a briefing
 * suggestion). Destructive tools must go through /api/assistant/confirm so
 * the confirmation card is never skipped.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });

  const tool = toolByName.get(parsed.data.tool);
  if (!tool) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  if (tool.kind === "destructive") {
    return NextResponse.json({ error: "This action needs confirmation." }, { status: 400 });
  }
  const args = tool.input.safeParse(parsed.data.args);
  if (!args.success) return NextResponse.json({ error: formatZodError(args.error) }, { status: 400 });

  try {
    const ctx = await contextForUser(user.id, "assistant");
    const result = await tool.run(ctx, args.data);
    if (tool.kind === "write") revalidatePath("/", "layout");
    const response: AssistantResponse = {
      reply: result.summary,
      actions: [{ tool: tool.name, summary: result.summary }],
      understood: true,
    };
    return NextResponse.json(response, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ToolFailure) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
}
