"use client";

import { useState } from "react";
import { Archive, CreditCard, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import {
  addBillAction,
  archiveAccountAction,
  deleteBillAction,
  payBillAction,
  saveAccountAction,
} from "@/server/actions/money";
import { ACCOUNT_KINDS, ACCOUNT_KIND_LABELS, type AccountKind } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { formatShortDate, type LocalDate } from "@/lib/date";
import type { MoneySummary } from "@/server/services/money";
import { cn } from "@/lib/utils";

export function AccountsPanel({ accounts, currency }: { accounts: MoneySummary["accounts"]; currency: string }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("bank");
  const [balance, setBalance] = useState("");
  const [dueDay, setDueDay] = useState("");
  const { pending, run } = useAction();

  return (
    <Card className="gap-3 p-4">
      <h2 className="text-sm font-medium">Accounts</h2>
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add your bank, cash and cards to track balances. Expenses work without them too.</p>
      ) : (
        <ul className="divide-y">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-3 py-2">
              {account.kind === "credit_card" ? <CreditCard className="size-4 text-muted-foreground" aria-hidden /> : null}
              <div className="min-w-0 flex-1">
                <p className="text-sm">{account.name}</p>
                <p className="text-xs text-muted-foreground">
                  {ACCOUNT_KIND_LABELS[account.kind]}
                  {account.creditLimit ? ` · limit ${formatMoney(account.creditLimit, currency)}` : ""}
                  {account.nextDueDate ? ` · due ${formatShortDate(account.nextDueDate)}` : ""}
                </p>
              </div>
              <span className={cn("tabular text-sm font-medium", account.kind === "credit_card" && account.balance > 0 && "text-brand")}>
                {account.kind === "credit_card" && account.balance > 0 ? "owes " : ""}
                {formatMoney(account.balance, currency)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={`Archive ${account.name}`}
                onClick={() => {
                  if (window.confirm(`Archive account "${account.name}"?`)) {
                    run(() => archiveAccountAction(account.id), { success: "Account archived" });
                  }
                }}
              >
                <Archive className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid grid-cols-2 gap-2 border-t pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            () =>
              saveAccountAction({
                name: name.trim(),
                kind,
                balance: balance.trim() === "" ? null : Number(balance.replace(",", ".")),
                dueDay: kind === "credit_card" && dueDay ? Number(dueDay) : null,
              }),
            { success: "Account saved", onSuccess: () => { setName(""); setBalance(""); setDueDay(""); } },
          );
        }}
      >
        <Field id="acct-name" label="Name">
          <Input id="acct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="HDFC savings" required />
        </Field>
        <Field id="acct-kind" label="Kind">
          <Select value={kind} onValueChange={(value) => setKind(value as AccountKind)}>
            <SelectTrigger id="acct-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_KINDS.map((option) => (
                <SelectItem key={option} value={option}>
                  {ACCOUNT_KIND_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field id="acct-balance" label={kind === "credit_card" ? "Owed now" : "Balance"}>
          <Input id="acct-balance" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" />
        </Field>
        {kind === "credit_card" ? (
          <Field id="acct-due" label="Due day of month">
            <Input id="acct-due" inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="15" />
          </Field>
        ) : (
          <div />
        )}
        <Button type="submit" variant="secondary" className="col-span-2" disabled={pending || !name.trim()}>
          Save account
        </Button>
      </form>
    </Card>
  );
}

export function BillsPanel({
  bills,
  today,
  currency,
}: {
  bills: MoneySummary["upcomingBills"];
  today: LocalDate;
  currency: string;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [monthly, setMonthly] = useState(false);
  const { pending, run } = useAction();

  return (
    <Card className="gap-3 p-4">
      <h2 className="text-sm font-medium">Bills &amp; pending payments</h2>
      {bills.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing due in the next 30 days.</p>
      ) : (
        <ul className="divide-y">
          {bills.map((bill) => (
            <li key={bill.id} className="flex items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm">{bill.name}</p>
                <p className={cn("text-xs", bill.overdue ? "text-brand" : "text-muted-foreground")}>
                  {bill.overdue ? "overdue · " : "due "}
                  {formatShortDate(bill.dueDate)}
                  {bill.dueDate === today ? " (today)" : ""}
                </p>
              </div>
              <span className="tabular text-sm font-medium">{formatMoney(bill.amount, currency)}</span>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => payBillAction({ billId: bill.id }), { success: `Paid ${bill.name}` })}>
                Pay
              </Button>
              <Button variant="ghost" size="icon" disabled={pending} aria-label={`Delete ${bill.name}`} onClick={() => run(() => deleteBillAction(bill.id), { success: "Bill removed" })}>
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid grid-cols-2 gap-2 border-t pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          run(
            () =>
              addBillAction({
                name: name.trim(),
                amount: Number(amount.replace(",", ".")),
                dueDate,
                recurrence: monthly ? "monthly" : "none",
              }),
            { success: "Bill added", onSuccess: () => { setName(""); setAmount(""); setDueDate(""); } },
          );
        }}
      >
        <Field id="bill-name" label="Name" className="col-span-2">
          <Input id="bill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Electricity" required />
        </Field>
        <Field id="bill-amount" label="Amount">
          <Input id="bill-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </Field>
        <Field id="bill-due" label="Due">
          <Input id="bill-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={monthly} onChange={(e) => setMonthly(e.target.checked)} className="size-4 accent-foreground" />
          Repeats monthly
        </label>
        <Button type="submit" variant="secondary" className="col-span-2" disabled={pending || !name.trim() || !amount || !dueDate}>
          Add bill
        </Button>
      </form>
    </Card>
  );
}
