"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { useEstimate } from "@/components/assistant/use-estimate";
import { EstimateButton } from "@/components/assistant/estimate-button";
import { logExpenseAction, logIncomeAction } from "@/server/actions/money";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from "@/lib/domain";

export interface MoneyAccountOption {
  id: string;
  name: string;
}

const NO_ACCOUNT = "none";

/** Spending and income are logged many times a day, so they get a dialog of their own. */
export function MoneyDialog({
  open,
  onOpenChange,
  accounts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MoneyAccountOption[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log money</DialogTitle>
          <DialogDescription>Saved against today.</DialogDescription>
        </DialogHeader>
        {open ? <MoneyForm accounts={accounts} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function MoneyForm({
  accounts,
  onDone,
}: {
  accounts: MoneyAccountOption[];
  onDone: () => void;
}) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("food");
  const [label, setLabel] = useState("");
  const [accountId, setAccountId] = useState(NO_ACCOUNT);
  const { pending, run } = useAction();
  const estimator = useEstimate();

  const suggestCategory = async () => {
    const value = Number(amount.replace(",", "."));
    const result = await estimator.estimate("expense_category", {
      label: label.trim(),
      amount: Number.isFinite(value) && value > 0 ? value : undefined,
    });
    if (result) setCategory(result.category);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const payload = {
          amount: Number(amount.replace(",", ".")),
          label: label.trim() || null,
          accountId: accountId === NO_ACCOUNT ? null : accountId,
        };
        run(
          () =>
            kind === "expense"
              ? logExpenseAction({ ...payload, category })
              : logIncomeAction(payload),
          { success: kind === "expense" ? "Expense logged" : "Income logged", onSuccess: onDone },
        );
      }}
    >
      <ToggleGroup
        type="single"
        value={kind}
        onValueChange={(value) => value && setKind(value as "expense" | "income")}
        aria-label="Kind"
      >
        <ToggleGroupItem value="expense" size="sm">Expense</ToggleGroupItem>
        <ToggleGroupItem value="income" size="sm">Income</ToggleGroupItem>
      </ToggleGroup>

      <div className="grid grid-cols-2 gap-3">
        <Field id="money-amount" label="Amount">
          <Input
            id="money-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="250"
            required
            autoFocus
          />
        </Field>
        {kind === "expense" ? (
          <Field id="money-category" label="Category">
            <Select value={category} onValueChange={(value) => setCategory(value as ExpenseCategory)}>
              <SelectTrigger id="money-category" className="w-full">
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
        <Field id="money-label" label="What" className="col-span-2">
          <Input
            id="money-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={kind === "expense" ? "lunch" : "salary"}
          />
        </Field>
        {accounts.length > 0 ? (
          <Field id="money-account" label="Account" className="col-span-2">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="money-account" className="w-full">
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
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {kind === "expense" ? (
          <EstimateButton
            onClick={() => void suggestCategory()}
            pending={estimator.pending}
            disabled={label.trim() === ""}
            label="Categorise"
            title="Pick the category from the description"
          />
        ) : null}
        <Button type="submit" size="sm" disabled={pending || !amount}>
          {kind === "expense" ? "Log expense" : "Log income"}
        </Button>
      </div>
    </form>
  );
}
