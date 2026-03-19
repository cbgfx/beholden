import React from "react";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { DraggableList } from "@/components/drag/DraggableList";
import { theme } from "@/theme/theme";
import { IconNotes, IconPlus } from "@/icons";
import type { Note } from "@/domain/types/domain";
import { NoteAccordionItem } from "@/views/CampaignView/components/NoteAccordionItem";

export function AdventureNotesPanel(props: {
  selectedAdventureId: string | null;
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
    <Panel
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <IconNotes /> Adventure Notes ({notes.length})
        </span>
      }
      actions={
        <IconButton onClick={props.onAdd} disabled={!props.selectedAdventureId} title="Add note">
          <IconPlus />
        </IconButton>
      }
    >
      {props.selectedAdventureId ? (
        notes.length ? (
          <DraggableList
            items={notes.map((n) => ({ id: n.id }))}
          activeIds={props.expandedNoteIds}
            onSelect={(id) => props.onToggle(id)}
            onReorder={props.onReorder}
            renderItem={(it) => {
              const n = notes.find((x) => x.id === it.id)!;
              return (
                <NoteAccordionItem
                  note={n}
                expanded={props.expandedNoteIds.includes(n.id)}
                  onToggle={() => props.onToggle(n.id)}
                  onEdit={() => props.onEdit(n.id)}
                  onDelete={() => props.onDelete(n.id)}
                />
              );
            }}
          />
        ) : (
          <div style={{ color: theme.colors.muted }}>No adventure notes yet.</div>
        )
      ) : (
        <div style={{ color: theme.colors.muted }}>Select an adventure.</div>
      )}
    </Panel>
  );
}
