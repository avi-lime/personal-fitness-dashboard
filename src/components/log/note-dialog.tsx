"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/common/field";
import { useAction } from "@/components/common/use-action";
import { addNoteAction } from "@/server/actions/logging";

export function NoteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add note</DialogTitle>
          <DialogDescription>Saved against today.</DialogDescription>
        </DialogHeader>
        {open ? <NoteForm onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function NoteForm({ onDone }: { onDone: () => void }) {
  const [note, setNote] = useState("");
  const { pending, run } = useAction();

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(() => addNoteAction({ note: note.trim() }), {
          success: "Note added",
          onSuccess: onDone,
        });
      }}
    >
      <Field id="note-body" label="Note">
        <Textarea
          id="note-body"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          required
          autoFocus
        />
      </Field>
      <DialogFooter>
        <Button type="submit" disabled={pending || note.trim() === ""}>
          Save note
        </Button>
      </DialogFooter>
    </form>
  );
}
