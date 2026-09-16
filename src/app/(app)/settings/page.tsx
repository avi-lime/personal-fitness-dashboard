import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/settings/profile-form";
import { DashboardSectionsForm } from "@/components/settings/dashboard-sections-form";
import { ThemeSection } from "@/components/settings/theme-section";
import { DataSection } from "@/components/settings/data-section";
import { requireContext } from "@/server/auth";
import { countGoals } from "@/server/services/goals";
import { NAV_ITEMS } from "@/components/layout/nav-items";

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
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">Signed in as {user.username}.</p>
      </div>

      <Card className="gap-3 p-4 md:hidden">
        <h2 className="text-sm font-medium">All pages</h2>
        <div className="grid grid-cols-2 gap-2">
          {NAV_ITEMS.map((item) => (
            <Button key={item.href} variant="outline" size="sm" className="justify-start" asChild>
              <Link href={item.href}>
                <item.icon className="size-4" aria-hidden /> {item.label}
              </Link>
            </Button>
          ))}
        </div>
      </Card>

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
