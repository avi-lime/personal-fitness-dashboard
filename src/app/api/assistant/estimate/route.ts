import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getProfileFor } from "@/server/auth";
import {
  assistantModel,
  createAssistantClient,
  describeAssistantError,
  isAssistantConfigured,
} from "@/assistant/client";
import { ESTIMATE_KINDS, EstimateError, runEstimate } from "@/assistant/estimate";
import { toLocalDate } from "@/lib/date";
import { formatZodError } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const bodySchema = z.object({
  kind: z.enum(ESTIMATE_KINDS),
  input: z.record(z.string(), z.unknown()),
});

/**
 * "Give me a sensible number" — food macros, an expense category, task
 * fields. Read-only: nothing is written; the form decides what to keep.
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
    const profile = await getProfileFor(user.id);
    const result = await runEstimate(
      parsed.data.kind,
      parsed.data.input,
      {
        today: toLocalDate(new Date(), profile.timezone),
        timezone: profile.timezone,
        currency: profile.currency,
      },
      createAssistantClient(),
      assistantModel(),
    );
    return NextResponse.json({ result }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: formatZodError(error) }, { status: 400 });
    }
    if (error instanceof EstimateError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: describeAssistantError(error) }, { status: 502 });
  }
}
