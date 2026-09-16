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
    <Button
      type="button"
      size="icon-lg"
      onClick={() => open("quick", { listen: supported })}
      aria-label={supported ? "Dictate a command" : "Quick entry"}
      className={cn(
        "fixed right-4 z-40 size-12 rounded-full bg-brand text-brand-foreground shadow-lg hover:bg-brand/90 md:hidden",
        className,
      )}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.5rem)" }}
    >
      <Mic className="size-5" aria-hidden />
    </Button>
  );
}
