import { MonitorView } from "@/components/monitor/monitor-view";
import { requireContext } from "@/server/auth";
import { buildMonitorPayload } from "@/server/services/monitor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monitor · Life Dashboard" };

export default async function MonitorPage() {
  const { user, timezone } = await requireContext();
  const payload = await buildMonitorPayload(user.id, timezone);
  return <MonitorView initial={payload} />;
}
