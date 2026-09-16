import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth";
import { contextForUser } from "@/mcp/context";
import {
  assistantModel,
  createAssistantClient,
  describeAssistantError,
  isAssistantConfigured,
} from "@/assistant/client";
import { runBriefing } from "@/assistant/briefing";
import { EstimateError } from "@/assistant/estimate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** On-demand "what should I do now" — read-only. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAssistantConfigured()) {
    return NextResponse.json({ error: "The assistant is not configured." }, { status: 503 });
  }
  try {
    const ctx = await contextForUser(user.id, "assistant");
    const briefing = await runBriefing(ctx, createAssistantClient(), assistantModel());
    return NextResponse.json(briefing, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof EstimateError) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: describeAssistantError(error) }, { status: 502 });
  }
}
