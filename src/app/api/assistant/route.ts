import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, getProfileFor } from "@/server/auth";
import { contextForUser } from "@/mcp/context";
import { TOOLS } from "@/mcp/registry";
import {
  assistantModel,
  createAssistantClient,
  describeAssistantError,
  isAssistantConfigured,
} from "@/assistant/client";
import { buildDigest } from "@/assistant/digest";
import { buildSystemPrompt } from "@/assistant/prompt";
import { runAssistant } from "@/assistant/runner";
import { describeError } from "@/lib/errors";
import { formatZodError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  input: z.string().trim().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }))
    .max(6)
    .default([]),
});

/**
 * One assistant turn. Session-authenticated like every page (the proxy only
 * exempts /api/mcp), so a request here is always the signed-in owner.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAssistantConfigured()) {
    return NextResponse.json({ error: "The assistant is not configured." }, { status: 503 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  try {
    const [ctx, profile] = await Promise.all([
      contextForUser(user.id, "assistant"),
      getProfileFor(user.id),
    ]);
    const digest = await buildDigest(ctx);
    const response = await runAssistant({
      client: createAssistantClient(),
      model: assistantModel(),
      tools: TOOLS,
      ctx,
      systemPrompt: buildSystemPrompt({ ctx, currency: profile.currency, digest }),
      history: parsed.data.history,
      input: parsed.data.input,
    });
    if (response.actions.length > 0) revalidatePath("/", "layout");
    return NextResponse.json(response, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error ? 502 : 500;
    return NextResponse.json(
      { error: status === 502 ? describeAssistantError(error) : describeError(error) },
      { status },
    );
  }
}
