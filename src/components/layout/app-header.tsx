import Link from "next/link";
import { LogOut, MonitorPlay, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Clock } from "@/components/layout/clock";
import { NavLinks } from "@/components/layout/nav-links";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { QuickEntryButton } from "@/components/layout/quick-entry-button";
import { logoutAction } from "@/server/actions/auth";
import { formatLongDate, toLocalTime, type LocalDate } from "@/lib/date";

export function AppHeader({ date, timezone }: { date: LocalDate; timezone: string }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-tight">
            {formatLongDate(date, timezone)}
          </p>
          <p className="text-xs text-muted-foreground">
            <Clock
              timezone={timezone}
              initialTime={toLocalTime(new Date(), timezone)}
              className="tabular"
            />
            <span className="mx-1.5">·</span>
            {timezone}
          </p>
        </div>

        <div className="order-3 w-full lg:order-none lg:w-auto lg:flex-1 lg:px-4">
          <NavLinks />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <QuickEntryButton />
          <Button variant="ghost" size="icon" asChild>
            <Link href="/monitor" title="Monitor mode" aria-label="Open monitor mode">
              <MonitorPlay className="size-4" />
            </Link>
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" asChild>
            <Link href="/settings" title="Settings" aria-label="Settings">
              <Settings className="size-4" />
            </Link>
          </Button>
          <form action={logoutAction}>
            <Button variant="ghost" size="icon" type="submit" title="Sign out" aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
