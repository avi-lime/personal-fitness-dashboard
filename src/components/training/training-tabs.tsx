"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const TRAINING_TABS = ["today", "body", "quests", "log"] as const;
export type TrainingTab = (typeof TRAINING_TABS)[number];

const LABELS: Record<TrainingTab, string> = { today: "Today", body: "Body", quests: "Quests", log: "Log" };

/** Tabs whose selection lives in the URL, so a link can open Quests directly. */
export function TrainingTabs({
  panels,
  badges,
}: {
  panels: Record<TrainingTab, ReactNode>;
  /** A count shown on a tab, e.g. missions ready to claim. */
  badges?: Partial<Record<TrainingTab, number>>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("tab");
  const value = (TRAINING_TABS as readonly string[]).includes(requested ?? "") ? (requested as TrainingTab) : "today";

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const query = new URLSearchParams(params.toString());
        if (next === "today") query.delete("tab");
        else query.set("tab", next);
        router.replace(query.size ? `/training?${query}` : "/training", { scroll: false });
      }}
    >
      <TabsList className="w-full sm:w-auto">
        {TRAINING_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="flex-1 gap-1.5 sm:flex-none">
            {LABELS[tab]}
            {badges?.[tab] ? (
              <span className="rounded-full bg-brand px-1.5 text-[10px] leading-4 text-brand-foreground tabular">
                {badges[tab]}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {TRAINING_TABS.map((tab) => (
        <TabsContent key={tab} value={tab} className="pt-4">
          {panels[tab]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
