import { NextResponse } from "next/server";
import { getCurrentUser, getProfileFor } from "@/server/auth";
import { exportDailyCsv, exportData } from "@/server/services/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exports the signed-in user's own data. `format=json` returns a complete
 * bundle that `importData` can read back; `format=csv` returns daily summaries.
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const profile = await getProfileFor(user.id);
    const csv = await exportDailyCsv(user.id, profile.timezone);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="life-dashboard-${stamp}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  const bundle = await exportData(user.id);
  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="life-dashboard-${stamp}.json"`,
      "cache-control": "no-store",
    },
  });
}
