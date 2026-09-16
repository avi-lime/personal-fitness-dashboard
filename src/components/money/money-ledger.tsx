"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { useEstimate } from "@/components/assistant/use-estimate";
import { EstimateButton } from "@/components/assistant/estimate-button";
import { deleteTransactionAction, logExpenseAction, logIncomeAction } from "@/server/actions/money";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { formatShortDate } from "@/lib/date";
import type { Transaction } from "@/db/schema";
import { cn } from "@/lib/utils";

const NO_ACCOUNT = "none";

export function MoneyLedger({
  transactions,
  accounts,
  currency,
}: {
  transactions: Transaction[];
  accounts: Array<{ id: string; name: string }>;
  currency: string;
}) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [label, setLabel] = useState("");
  const [accountId, setAccountId] = useState<string>(NO_ACCOUNT);
  const { pending, run } = useAction();
  const estimator = useEstimate();
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;

  const suggestCategory = async () => {
    const value = Number(amount.replace(",", "."));
    const result = await estimator.estimate("expense_category", {
      label: label.trim(),
      amount: Number.isFinite(value) && value > 0 ? value : undefined,
    });
    if (result) setCategory(result.category);
  };

  return (
    <div className="space-y-4">
      <Card className="gap-3 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium">Log</h2>
          <div className="ml-auto flex gap-1" role="group" aria-label="Kind">
            {(["expense", "income"] as const).map((option) => (
              <Button key={option} size="sm" variant={kind === option ? "default" : "ghost"} onClick={() => setKind(option)} aria-pressed={kind === option} className="capitalize">
                {option}
              </Button>
            ))}
          </div>
        </div>
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const value = Number(amount.replace(",", "."));
            const payload = {
              amount: value,
              label: label.trim() || null,
              accountId: accountId === NO_ACCOUNT ? null : accountId,
            };
            run(
              () =>
                kind === "expense"
                  ? logExpenseAction({ ...payload, category })
                  : logIncomeAction(payload),
              {
                success: kind === "expense" ? "Expense logged" : "Income logged",
                onSuccess: () => {
                  setAmount("");
                  setLabel("");
                },
              },
            );
          }}
        >
          <Field id="tx-amount" label="Amount" className="w-32">
            <Input id="tx-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="250" required autoFocus />
          </Field>
          {kind === "expense" ? (
            <Field id="tx-category" label="Category" className="w-40">
              <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
                <SelectTrigger id="tx-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {EXPENSE_CATEGORY_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field id="tx-label" label="What" className="min-w-40 flex-1">
            <div className="flex gap-2">
              <Input id="tx-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={kind === "expense" ? "lunch" : "salary"} />
              {kind === "expense" ? (
                <EstimateButton
                  onClick={() => void suggestCategory()}
                  pending={estimator.pending}
                  disabled={label.trim() === ""}
                  label="Categorise"
                  title="Pick the category from the description"
                />
              ) : null}
            </div>
          </Field>
          {accounts.length > 0 ? (
            <Field id="tx-account" label="Account" className="w-40">
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="tx-account" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ACCOUNT}>No account</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Button type="submit" disabled={pending || !amount}>
            {kind === "expense" ? "Log expense" : "Log income"}
          </Button>
        </form>
      </Card>

      <Card className="gap-0 p-0">
        <h2 className="border-b px-4 py-2.5 text-sm font-medium">Recent</h2>
        {transactions.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No transactions yet" description='Log one above, or say "I spent 250 on lunch".' />
          </div>
        ) : (
          <ul className="divide-y">
            {transactions.map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="tabular w-14 shrink-0 text-xs text-muted-foreground">{formatShortDate(tx.localDate)}</span>
                <span className="min-w-0 flex-1 text-sm">
                  {tx.label ?? EXPENSE_CATEGORY_LABELS[tx.category]}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {tx.kind === "expense" || tx.kind === "payment" ? EXPENSE_CATEGORY_LABELS[tx.category] : tx.kind}
                    {accountName(tx.accountId) ? ` · ${accountName(tx.accountId)}` : ""}
                  </span>
                </span>
                <span className={cn("tabular text-sm font-medium", tx.kind === "income" && "text-positive")}>
                  {tx.kind === "income" ? "+" : tx.kind === "transfer" ? "↔" : "−"}
                  {formatMoney(tx.amount, currency)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label="Delete transaction"
                  onClick={() => {
                    if (window.confirm("Delete this transaction and reverse its balance effect?")) {
                      run(() => deleteTransactionAction(tx.id), { success: "Transaction deleted" });
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
