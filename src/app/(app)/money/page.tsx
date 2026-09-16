import { MoneyOverview } from "@/components/money/money-overview";
import { MoneyLedger } from "@/components/money/money-ledger";
import { AccountsPanel, BillsPanel } from "@/components/money/accounts-bills";
import { requireContext } from "@/server/auth";
import { getMoneySummary } from "@/server/services/money";
import { toLocalDate } from "@/lib/date";

export const dynamic = "force-dynamic";
export const metadata = { title: "Money · Life Dashboard" };

export default async function MoneyPage() {
  const { user, timezone, profile } = await requireContext();
  const today = toLocalDate(new Date(), timezone);
  const summary = await getMoneySummary(user.id, timezone, profile.currency, today);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl">Money</h1>
        <p className="text-sm text-muted-foreground">
          Manual ledger in {profile.currency}: spending, income, balances and bills. Balances update with every entry.
        </p>
      </div>
      <MoneyOverview summary={summary} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <MoneyLedger transactions={summary.recent} accounts={summary.accounts} currency={summary.currency} />
        <div className="space-y-5">
          <BillsPanel bills={summary.upcomingBills} today={today} currency={summary.currency} />
          <AccountsPanel accounts={summary.accounts} currency={summary.currency} />
        </div>
      </div>
    </div>
  );
}
