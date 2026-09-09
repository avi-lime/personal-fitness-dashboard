import { NextResponse } from "next/server";
import { getCurrentUser, getProfileFor } from "@/server/auth";
import { buildMonitorPayload } from "@/server/services/monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Polled by monitor mode. Session-authenticated, same as the pages. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getProfileFor(user.id);
  const payload = await buildMonitorPayload(user.id, profile.timezone);
  return NextResponse.json(payload, {
    headers: { "cache-control": "no-store" },
  });
}
