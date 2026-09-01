import { NoteList } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import type { PlayerNote } from "@/views/character/CharacterSheetTypes";
import { CollapsiblePanel, PanelHeaderAddButton } from "@/views/character/CharacterViewParts";
import { PANEL_IDS } from "@/views/character/panelRegistry";

export function PlayerNotesPanel(props: {
  accentColor: string;
  playerNotesList: PlayerNote[];
  expandedNoteIds: string[];
  onOpenPlayerNoteCreate: () => void;
  onToggleNoteExpanded: (id: string) => void;
  onOpenPlayerNoteEdit: (note: PlayerNote) => void;
  onDeletePlayerNote: (id: string) => void;
  onSavePlayerNotesOrder: (list: PlayerNote[]) => void;
}) {
  const {
    accentColor,
    playerNotesList,
    expandedNoteIds,
    onOpenPlayerNoteCreate,
    onToggleNoteExpanded,
    onOpenPlayerNoteEdit,
    onDeletePlayerNote,
    onSavePlayerNotesOrder,
  } = props;

  return (
    <CollapsiblePanel
      title={`Player Notes (${playerNotesList.length})`}
      color={accentColor}
      storageKey={PANEL_IDS.playerNotes}
      actions={<PanelHeaderAddButton color={accentColor} onClick={onOpenPlayerNoteCreate} title="Add note" />}
    >
      <NoteList
        items={playerNotesList.map((note) => ({ id: note.id, title: note.title || "Untitled", text: note.text }))}
        expandedIds={expandedNoteIds}
        accentColor={accentColor}
        textColor={C.text}
        mutedColor={C.muted}
        deleteColor={C.red}
        onToggle={onToggleNoteExpanded}
        onEdit={(id) => {
          const note = playerNotesList.find((entry) => entry.id === id);
          if (note) onOpenPlayerNoteEdit(note);
        }}
        onDelete={onDeletePlayerNote}
        onReorder={(ids) => {
          const byId = Object.fromEntries(playerNotesList.map((n) => [n.id, n]));
          onSavePlayerNotesOrder(ids.map((id) => byId[id]).filter(Boolean));
        }}
        emptyText="No notes yet."
      />
    </CollapsiblePanel>
  );
}
