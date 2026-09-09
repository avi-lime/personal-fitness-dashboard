import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/settings/profile-form";
import { DashboardSectionsForm } from "@/components/settings/dashboard-sections-form";
import { ThemeSection } from "@/components/settings/theme-section";
import { DataSection } from "@/components/settings/data-section";
import { requireContext } from "@/server/auth";
import { countGoals } from "@/server/services/goals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings · Life Dashboard" };

/** A short, curated timezone list plus whatever the profile already uses. */
function timezoneOptions(current: string): string[] {
  const supported =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  const list = supported.length > 0 ? supported : ["UTC", current];
  return list.includes(current) ? list : [current, ...list];
}

export default async function SettingsPage() {
  const { user, profile, sections } = await requireContext();
  const goalCount = await countGoals(user.id);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.username}.</p>
      </div>

      <ProfileForm profile={profile} timezones={timezoneOptions(profile.timezone)} />

      <Card className="flex-row flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 className="text-sm font-medium">Goals</h2>
          <p className="text-sm text-muted-foreground">
            {goalCount} {goalCount === 1 ? "goal" : "goals"} configured. Add, edit, pause, reorder
            and archive them on the goals page.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/goals">Manage goals</Link>
        </Button>
      </Card>

      <DashboardSectionsForm sections={sections} />
      <ThemeSection saved={profile.theme} />
      <DataSection />
    </div>
  );
}
