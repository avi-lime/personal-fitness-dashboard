"use client";

import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogDialogs } from "@/components/log/log-provider";
import { useSpeechRecognition } from "./use-speech-recognition";

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
