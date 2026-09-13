import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
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
  const translateUi = useUiTranslation("dmUi");
  const notes = props.notes;

  return (
    <NotesPanel
      storageKey="campaign-notes"
      title={translateUi("Campaign Notes ({{value1}})", { value1: notes.length })}
      color={`var(--campaign-accent, ${theme.colors.accentPrimary})`}
      borderColor="transparent"
      actions={
        <IconButton onClick={props.onAdd} title={translateUi("Add note")} variant="accent">
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
        emptyText={translateUi("No campaign notes yet.")}
      />
    </NotesPanel>
  );
}
