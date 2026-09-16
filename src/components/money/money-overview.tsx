import { Card } from "@/components/ui/card";
import { Stat } from "@/components/common/stat";
import { formatMoney } from "@/lib/format";
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/domain";
import type { MoneySummary } from "@/server/services/money";

/** The numbers that matter at a glance; server-rendered. */
export function MoneyOverview({ summary }: { summary: MoneySummary }) {
  const { currency } = summary;
  const categories = Object.entries(summary.byCategoryThisMonth).sort(([, a], [, b]) => b - a);
  const monthTotal = summary.spentThisMonth || 1;

  return (
    <Card className="gap-4 p-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Spent today" value={formatMoney(summary.spentToday, currency)} />
        <Stat label="This week" value={formatMoney(summary.spentThisWeek, currency)} />
        <Stat label="This month" value={formatMoney(summary.spentThisMonth, currency)} detail={`income ${formatMoney(summary.incomeThisMonth, currency)}`} />
        <Stat label="Available" value={formatMoney(summary.netAvailable, currency)} detail="bank + cash + wallets" />
        <Stat label="Owed on cards" value={formatMoney(summary.totalOwed, currency)} />
        <Stat
          label="Bills due"
          value={formatMoney(summary.upcomingBillsTotal, currency)}
          detail={`${summary.upcomingBills.length} in 30 days`}
        />
      </div>
      {categories.length > 0 ? (
        <div className="space-y-1.5 border-t pt-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">This month by category</p>
          <ul className="space-y-1">
            {categories.slice(0, 6).map(([category, amount]) => (
              <li key={category} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-muted-foreground">
                  {EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                  <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${Math.min(100, (amount / monthTotal) * 100)}%` }} />
                </span>
                <span className="tabular w-24 text-right">{formatMoney(amount, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
