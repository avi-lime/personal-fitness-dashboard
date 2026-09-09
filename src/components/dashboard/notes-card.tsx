import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/common/empty-state";
import { AddNoteButton } from "@/components/dashboard/add-note-button";
import type { Note } from "@/db/schema";

export function NotesCard({ notes }: { notes: Note[] }) {
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Notes today</h2>
        <AddNoteButton />
      </div>
      {notes.length === 0 ? (
        <EmptyState title="No notes today" description="Jot down how the day went." />
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border px-3 py-2 text-sm">
              {note.body}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
