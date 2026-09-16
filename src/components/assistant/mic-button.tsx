"use client";

import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogDialogs } from "@/components/log/log-provider";
import { useSpeechRecognition } from "./use-speech-recognition";
import { cn } from "@/lib/utils";

/** Header microphone: opens the assistant already listening. */
export function AssistantMicButton() {
  const { open } = useLogDialogs();
  const { supported } = useSpeechRecognition(() => {});
  if (!supported) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => open("quick", { listen: true })}
      title="Dictate (Ctrl+Shift+K)"
      aria-label="Dictate a command"
    >
      <Mic className="size-4" />
    </Button>
  );
}

/** Floating action button for phones — thumb reach, above the tab bar. */
export function AssistantFab({ className }: { className?: string }) {
  const { open } = useLogDialogs();
  const { supported } = useSpeechRecognition(() => {});
  return (
    <button
      type="button"
      onClick={() => open("quick", { listen: supported })}
      aria-label={supported ? "Dictate a command" : "Quick entry"}
      className={cn(
        "fixed right-4 z-40 flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-lg outline-none transition-transform active:scale-95 focus-visible:ring-3 focus-visible:ring-brand/40 md:hidden",
        className,
      )}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 5rem)" }}
    >
      <Mic className="size-6" aria-hidden />
    </button>
  );
}
