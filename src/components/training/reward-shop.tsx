"use client";

import { useState } from "react";
import { Coins, Gift, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/common/field";
import { ConfirmButton } from "@/components/common/confirm-button";
import { EmptyState } from "@/components/common/empty-state";
import { useAction } from "@/components/common/use-action";
import { createRewardAction, redeemRewardAction, removeRewardAction } from "@/server/actions/training";
import type { RpgReward } from "@/db/schema";

/** Starting points only — nothing is added until the user picks one. */
const IDEAS: Array<{ name: string; cost: number }> = [
  { name: "Cheat meal", cost: 150 },
  { name: "A guilt-free lazy day", cost: 100 },
  { name: "New gym t-shirt", cost: 600 },
];

/**
 * Real-life rewards bought with gold from missions. The user sets the
 * prices, so the game pays out in things they actually want.
 */
export function RewardShop({ rewards, gold }: { rewards: RpgReward[]; gold: number }) {
  const [name, setName] = useState("");
  const [cost, setCost] = useState("");
  const { pending, run } = useAction();

  const add = (reward: { name: string; cost: number }) =>
    run(() => createRewardAction(reward), {
      success: `"${reward.name}" added`,
      onSuccess: () => {
        setName("");
        setCost("");
      },
    });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs tracking-widest text-muted-foreground uppercase">Reward shop</h3>
        <p className="flex items-center gap-1 text-sm tabular">
          <Coins className="size-3.5 text-brand" aria-hidden /> {gold} gold
        </p>
      </div>

      {rewards.length === 0 ? (
        <EmptyState title="No rewards yet." description="Price something you'd enjoy in gold, then earn it." />
      ) : (
        <ul className="space-y-2">
          {rewards.map((reward) => {
            const affordable = gold >= reward.cost;
            return (
              <li key={reward.id} className="flex items-center gap-3 rounded-xl bg-surface-3 p-3 ring-1 ring-border">
                <Gift className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{reward.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-sm tabular">
                  <Coins className="size-3 text-brand" aria-hidden />
                  {reward.cost}
                </span>
                <ConfirmButton
                  size="sm"
                  variant={affordable ? "default" : "outline"}
                  disabled={pending || !affordable}
                  title={`Redeem "${reward.name}"?`}
                  description={`Spends ${reward.cost} of your ${gold} gold. Go enjoy it.`}
                  confirmLabel="Redeem"
                  onConfirm={() =>
                    run(() => redeemRewardAction(reward.id), {
                      onSuccess: (result) => toast.success(`Enjoy: ${reward.name}`, { description: `${result.balance} gold left` }),
                    })
                  }
                >
                  {affordable ? "Redeem" : `${reward.cost - gold} more`}
                </ConfirmButton>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  aria-label={`Remove ${reward.name}`}
                  onClick={() => run(() => removeRewardAction(reward.id), { success: "Reward removed" })}
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="grid grid-cols-[minmax(0,1fr)_6rem_auto] items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const price = Number.parseInt(cost, 10);
          if (name.trim() && price > 0) add({ name: name.trim(), cost: price });
        }}
      >
        <Field id="reward-name" label="Reward">
          <Input id="reward-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Movie night" />
        </Field>
        <Field id="reward-cost" label="Gold">
          <Input id="reward-cost" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="200" />
        </Field>
        <Button type="submit" size="sm" disabled={pending || !name.trim() || !cost} className="justify-self-start">
          Add
        </Button>
      </form>

      {rewards.length === 0 ? (
        <div className="flex flex-wrap gap-2">
          {IDEAS.map((idea) => (
            <Button key={idea.name} variant="outline" size="sm" disabled={pending} onClick={() => add(idea)}>
              {idea.name} · {idea.cost}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
