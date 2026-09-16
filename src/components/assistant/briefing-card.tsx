"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Briefing } from "@/assistant/briefing";
import type { AssistantResponse } from "@/assistant/types";
import { cn } from "@/lib/utils";

const cacheKey = (date: string) => `briefing:${date}`;

function readCache(date: string): Briefing | null {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(date));
    return raw ? (JSON.parse(raw) as Briefing) : null;
  } catch {
    return null;
  }
}

/**
 * The personal assistant's take on the day: one line, a few concrete
 * suggestions, and a "Do it" for the ones the app can carry out itself.
 * Generated on demand (a model call), kept for the session.
 */
export function BriefingCard({ date }: { date: string }) {
  const [briefing, setBriefing] = useState<Briefing | null>(() => readCache(date));
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<Set<number>>(() => new Set());
  const [running, setRunning] = useState<number | null>(null);
  const router = useRouter();

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/assistant/briefing", { method: "POST" });
      const json = (await response.json()) as Briefing | { error: string };
      if (!response.ok || "error" in json) {
        toast.error("error" in json ? json.error : "Could not get a briefing.");
        return;
      }
      setBriefing(json);
      setDone(new Set());
      try {
        window.sessionStorage.setItem(cacheKey(date), JSON.stringify(json));
      } catch {
        // Session storage is a convenience only.
      }
    } catch {
      toast.error("Could not reach the assistant.");
    } finally {
      setLoading(false);
    }
  };

  const act = async (index: number, action: NonNullable<Briefing["suggestions"][number]["action"]>) => {
    setRunning(index);
    try {
      const response = await fetch("/api/assistant/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tool: action.tool, args: action.args }),
      });
      const json = (await response.json()) as AssistantResponse | { error: string };
      if (!response.ok || "error" in json) {
        toast.error("error" in json ? json.error : "That did not work.");
        return;
      }
      toast.success(json.reply);
      setDone((previous) => new Set(previous).add(index));
      router.refresh();
    } catch {
      toast.error("Could not reach the assistant.");
    } finally {
      setRunning(null);
    }
  };

  return (
    <Card className="gap-3 bg-surface-3 p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span className="size-1.5 rounded-full bg-brand" aria-hidden />
          Assistant
        </h2>
        <Button variant={briefing ? "ghost" : "default"} size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <RefreshCw className="size-3.5 animate-spin" aria-hidden />
          ) : briefing ? (
            <RefreshCw className="size-3.5" aria-hidden />
          ) : null}
          {loading ? "Thinking…" : briefing ? "Refresh" : "What should I do?"}
        </Button>
      </div>

      {!briefing ? (
        <p className="text-sm text-muted-foreground">
          Get a short, specific take on the day — what is overdue, due, or furthest behind — with one-click actions.
        </p>
      ) : (
        <>
          <p className="font-display text-xl leading-snug">{briefing.headline}</p>
          <ol className="divide-y">
            {briefing.suggestions.map((suggestion, index) => {
              const finished = done.has(index);
              return (
                <li key={index} className="flex items-start gap-3 py-2.5">
                  <span className="tabular mt-0.5 w-4 shrink-0 text-xs text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", finished && "text-muted-foreground line-through")}>
                      {suggestion.title}
                    </p>
                    <p className="text-xs text-muted-foreground">{suggestion.why}</p>
                  </div>
                  {suggestion.action ? (
                    <Button
                      size="sm"
                      variant={finished ? "ghost" : "secondary"}
                      disabled={finished || running !== null}
                      onClick={() => void act(index, suggestion.action!)}
                      title={suggestion.action.label}
                    >
                      {finished ? <Check className="size-3.5" aria-hidden /> : null}
                      {finished ? "Done" : running === index ? "…" : "Do it"}
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Card>
  );
}
