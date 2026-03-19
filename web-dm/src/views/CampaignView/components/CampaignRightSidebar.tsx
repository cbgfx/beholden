import React from "react";
import { CampaignNotesPanel } from "@/views/CampaignView/panels/CampaignNotesPanel";
import { AdventureNotesPanel } from "@/views/CampaignView/panels/AdventureNotesPanel";
import type { Note } from "@/domain/types/domain";

export function CampaignRightSidebar(props: {
  selectedAdventureId: string | null;
  campaignNotes: Note[];
  adventureNotes: Note[];
  expandedNoteIds: string[]
  onToggleNote: (noteId: string) => void;

  onAddCampaignNote: () => void;
  onEditCampaignNote: (noteId: string) => void;
  onDeleteCampaignNote: (noteId: string) => void;
  onReorderCampaignNotes: (ids: string[]) => void;

  onAddAdventureNote: () => void;
  onEditAdventureNote: (noteId: string) => void;
  onDeleteAdventureNote: (noteId: string) => void;
  onReorderAdventureNotes: (ids: string[]) => void;
}) {
  return (
    <div className="campaignCol">
      <CampaignNotesPanel
        notes={props.campaignNotes}
        expandedNoteIds={props.expandedNoteIds}
        onToggle={props.onToggleNote}
        onAdd={props.onAddCampaignNote}
        onEdit={props.onEditCampaignNote}
        onDelete={props.onDeleteCampaignNote}
        onReorder={props.onReorderCampaignNotes}
      />

      <AdventureNotesPanel
        selectedAdventureId={props.selectedAdventureId}
        notes={props.adventureNotes}
        expandedNoteIds={props.expandedNoteIds}
        onToggle={props.onToggleNote}
        onAdd={props.onAddAdventureNote}
        onEdit={props.onEditAdventureNote}
        onDelete={props.onDeleteAdventureNote}
        onReorder={props.onReorderAdventureNotes}
      />
    </div>
  );
}
