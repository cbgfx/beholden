import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { NoteList } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import type { PlayerNote } from "@/views/character/CharacterSheetTypes";
import { CollapsiblePanel, PanelHeaderAddButton } from "@/views/character/CharacterViewParts";
import { PANEL_IDS } from "@/views/character/layout/panelRegistry";

/**
 * Shared notes come from two places and only one of them is the player's to change: the DM writes
 * notes on the campaign, the player writes their own on the character.
 *
 * They used to be merged into a single sortable list, so a player could edit, delete or drag one of
 * the DM's notes and watch the change come back on the next refresh - the save quietly dropped it.
 * Two lists, one of them plainly read-only, means what you can do is what you see.
 */
export function SharedNotesPanel(props: {
  accentColor: string;
  allSharedNotes: PlayerNote[];
  campaignNoteIds: string[];
  expandedNoteIds: string[];
  onOpenSharedNoteCreate: () => void;
  onToggleNoteExpanded: (id: string) => void;
  onOpenSharedNoteEdit: (note: PlayerNote) => void;
  onDeleteSharedNote: (id: string) => void;
  onSaveSharedNotesOrder: (list: PlayerNote[]) => void;
}) {
  const translateUi = useUiTranslation("playerUi");
  const {
    accentColor,
    allSharedNotes,
    campaignNoteIds,
    expandedNoteIds,
    onOpenSharedNoteCreate,
    onToggleNoteExpanded,
    onOpenSharedNoteEdit,
    onDeleteSharedNote,
    onSaveSharedNotesOrder,
  } = props;

  const fromDm = allSharedNotes.filter((note) => campaignNoteIds.includes(note.id));
  const mine = allSharedNotes.filter((note) => !campaignNoteIds.includes(note.id));
  const toItem = (note: PlayerNote) => ({ id: note.id, title: note.title, text: note.text });

  return (
    <CollapsiblePanel
      title={translateUi("Shared Notes ({{value1}})", { value1: allSharedNotes.length })}
      color={accentColor}
      storageKey={PANEL_IDS.sharedNotes}
      actions={<PanelHeaderAddButton color={accentColor} onClick={onOpenSharedNoteCreate} title={translateUi("Add shared note")} />}
    >
      <div style={{ display: "grid", gap: 10 }}>
        {fromDm.length > 0 ? (
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {translateUi("From the DM")}
            </div>
            <NoteList
              items={fromDm.map((note) => ({ ...toItem(note), readOnly: true }))}
              expandedIds={expandedNoteIds}
              accentColor={accentColor}
              textColor={C.text}
              mutedColor={C.muted}
              deleteColor={C.red}
              onToggle={onToggleNoteExpanded}
            />
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 4 }}>
          {fromDm.length > 0 ? (
            <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {translateUi("Mine")}
            </div>
          ) : null}
          <NoteList
            items={mine.map(toItem)}
            expandedIds={expandedNoteIds}
            accentColor={accentColor}
            textColor={C.text}
            mutedColor={C.muted}
            deleteColor={C.red}
            onToggle={onToggleNoteExpanded}
            onEdit={(id) => {
              const note = mine.find((entry) => entry.id === id);
              if (note) onOpenSharedNoteEdit(note);
            }}
            onDelete={onDeleteSharedNote}
            onReorder={(ids) => {
              const byId = Object.fromEntries(mine.map((note) => [note.id, note]));
              onSaveSharedNotesOrder(ids.map((id) => byId[id]).filter(Boolean));
            }}
            emptyText={translateUi("No notes yet.")}
          />
        </div>
      </div>
    </CollapsiblePanel>
  );
}
