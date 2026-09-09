"use client";

import { useMemo, useState } from "react";
import { CornerDownLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/components/common/use-action";
import { runQuickEntryAction } from "@/server/actions/quick-entry";
import { QUICK_ENTRY_EXAMPLES, describeIntent, parseQuickEntry } from "@/lib/quick-entry";

/**
 * Type one line, press Enter. Parsing happens locally for instant feedback and
 * again on the server, which is the only side that writes anything.
 */
export function QuickEntryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Quick entry</DialogTitle>
          <DialogDescription>Log an entry by typing a short command.</DialogDescription>
        </DialogHeader>
        {open ? <QuickEntryForm onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function QuickEntryForm({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState("");
  const { pending, run } = useAction();
  const intent = useMemo(() => parseQuickEntry(value), [value]);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!intent) return;
        run(() => runQuickEntryAction(value), {
          success: describeIntent(intent),
          onSuccess: onDone,
        });
      }}
    >
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="+500 ml water"
        autoFocus
        aria-label="Quick entry command"
        className="h-12 text-base md:text-base"
      />
      <div className="mt-3 flex min-h-9 items-center gap-3 text-sm">
        <div className="flex-1" aria-live="polite">
          {value.trim() === "" ? (
            <p className="text-muted-foreground">
              Try one of: {QUICK_ENTRY_EXAMPLES.slice(0, 4).join(" · ")}
            </p>
          ) : intent ? (
            <p className="flex items-center gap-2 font-medium">
              <CornerDownLeft className="size-4 text-muted-foreground" aria-hidden />
              {describeIntent(intent)}
            </p>
          ) : (
            <p className="text-muted-foreground">
              Not recognised. Examples: {QUICK_ENTRY_EXAMPLES.slice(0, 3).join(" · ")}
            </p>
          )}
        </div>
        <Button type="submit" size="sm" disabled={pending || !intent}>
          Log entry
        </Button>
      </div>
    </form>
  );
}
