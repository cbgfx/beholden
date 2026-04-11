import React from "react";
import { IconButton } from "@/ui/IconButton";
import { theme } from "@/theme/theme";
import { IconPlus } from "@/icons";
import type { Note } from "@/domain/types/domain";
import { NoteList, NotesPanel } from "@beholden/shared/ui";

export function CampaignNotesPanel(props: {
  notes: Note[];
  expandedNoteIds: string[];
  onToggle: (noteId: string) => void;
  onAdd: () => void;
  onEdit: (noteId: string) => void;
  onDelete: (noteId: string) => void;
  onReorder: (ids: string[]) => void;
}) {
  const notes = props.notes;

  return (
    <NotesPanel
      storageKey="campaign-notes"
      title={`Campaign Notes (${notes.length})`}
      color={`var(--campaign-accent, ${theme.colors.accentPrimary})`}
      actions={
        <IconButton onClick={props.onAdd} title="Add note" variant="accent">
          <IconPlus />
        </IconButton>
      }
    >
      <NoteList
        items={notes.map((note) => ({ id: note.id, title: note.title || "Untitled", text: note.text }))}
        expandedIds={props.expandedNoteIds}
        accentColor={`var(--campaign-accent, ${theme.colors.accentPrimary})`}
        textColor={theme.colors.text}
        mutedColor={theme.colors.muted}
        deleteColor={theme.colors.red}
        onToggle={props.onToggle}
        onEdit={props.onEdit}
        onDelete={props.onDelete}
        onReorder={props.onReorder}
        emptyText="No campaign notes yet."
      />
    </NotesPanel>
  );
}
