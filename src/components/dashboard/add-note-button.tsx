"use client";

import { Button } from "@/components/ui/button";
import { useLogDialogs } from "@/components/log/log-provider";

export function AddNoteButton() {
  const { open } = useLogDialogs();
  return (
    <Button size="sm" variant="ghost" onClick={() => open("note")}>
      Add note
    </Button>
  );
}
