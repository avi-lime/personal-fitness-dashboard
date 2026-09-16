import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Stat } from "@/components/common/stat";
import { formatMoney } from "@/lib/format";
import { formatShortDate, type LocalDate } from "@/lib/date";
import type { Bill } from "@/db/schema";
import { cn } from "@/lib/utils";

export function MoneyCard({
  currency,
  spentToday,
  spentThisWeek,
  bills,
  today,
}: {
  currency: string;
  spentToday: number;
  spentThisWeek: number;
  bills: Bill[];
  today: LocalDate;
}) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Money</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/money">Open</Link>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Spent today" value={formatMoney(spentToday, currency)} />
        <Stat label="This week" value={formatMoney(spentThisWeek, currency)} />
      </div>
      {bills.length > 0 ? (
        <ul className="space-y-1 border-t pt-3 text-sm">
          {bills.slice(0, 3).map((bill) => {
            const late = bill.dueDate < today;
            return (
              <li key={bill.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{bill.name}</span>
                <span className={cn("tabular text-xs", late || bill.dueDate === today ? "text-brand" : "text-muted-foreground")}>
                  {formatMoney(bill.amount, currency)} · {late ? "overdue" : bill.dueDate === today ? "today" : formatShortDate(bill.dueDate)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}
