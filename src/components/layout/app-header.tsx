import { Clock } from "@/components/layout/clock";
import { NavLinks } from "@/components/layout/nav-links";
import { HeaderMenu } from "@/components/layout/header-menu";
import { QuickEntryButton } from "@/components/layout/quick-entry-button";
import { AssistantMicButton } from "@/components/assistant/mic-button";
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
          </p>
        </div>

        <div className="order-3 hidden w-full md:block lg:order-none lg:w-auto lg:flex-1 lg:px-4">
          <NavLinks />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <QuickEntryButton />
          <AssistantMicButton />
          <HeaderMenu />
        </div>
      </div>
    </header>
  );
}
