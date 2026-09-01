import { NoteList } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import type { PlayerNote } from "@/views/character/CharacterSheetTypes";
import { CollapsiblePanel, PanelHeaderAddButton } from "@/views/character/CharacterViewParts";
import { PANEL_IDS } from "@/views/character/panelRegistry";

export function SharedNotesPanel(props: {
  accentColor: string;
  allSharedNotes: PlayerNote[];
  expandedNoteIds: string[];
  onOpenSharedNoteCreate: () => void;
  onToggleNoteExpanded: (id: string) => void;
  onOpenSharedNoteEdit: (note: PlayerNote) => void;
  onDeleteSharedNote: (id: string) => void;
  onSaveSharedNotesOrder: (list: PlayerNote[]) => void;
}) {
  const {
    accentColor,
    allSharedNotes,
    expandedNoteIds,
    onOpenSharedNoteCreate,
    onToggleNoteExpanded,
    onOpenSharedNoteEdit,
    onDeleteSharedNote,
    onSaveSharedNotesOrder,
  } = props;

  return (
    <CollapsiblePanel
      title={`Shared Notes (${allSharedNotes.length})`}
      color={accentColor}
      storageKey={PANEL_IDS.sharedNotes}
      actions={<PanelHeaderAddButton color={accentColor} onClick={onOpenSharedNoteCreate} title="Add shared note" />}
    >
      <NoteList
        items={allSharedNotes.map((note) => ({ id: note.id, title: note.title || "Untitled", text: note.text }))}
        expandedIds={expandedNoteIds}
        accentColor={accentColor}
        textColor={C.text}
        mutedColor={C.muted}
        deleteColor={C.red}
        onToggle={onToggleNoteExpanded}
        onEdit={(id) => {
          const note = allSharedNotes.find((entry) => entry.id === id);
          if (note) onOpenSharedNoteEdit(note);
        }}
        onDelete={onDeleteSharedNote}
        onReorder={(ids) => {
          const byId = Object.fromEntries(allSharedNotes.map((n) => [n.id, n]));
          onSaveSharedNotesOrder(ids.map((id) => byId[id]).filter(Boolean));
        }}
        emptyText="No notes yet."
      />
    </CollapsiblePanel>
  );
}
