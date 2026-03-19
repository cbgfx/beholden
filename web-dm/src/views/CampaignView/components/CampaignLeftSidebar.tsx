import React from "react";
import { AdventuresPanel } from "@/views/CampaignView/panels/AdventuresPanel";
import { EncountersPanel } from "@/views/CampaignView/panels/EncountersPanel";
import { TreasurePanel } from "@/views/CampaignView/panels/TreasurePanel";
import type { Adventure } from "@/domain/types/domain";

export function CampaignLeftSidebar(props: {
  adventures: Adventure[];
  selectedAdventureId: string | null;
  encounters: { id: string; name: string; status: string }[];
  selectedEncounterId: string | null;

  onSelectAdventure: (id: string) => void;
  onCreateAdventure: () => void;
  onEditAdventure: (adventureId: string) => void;
  onDeleteAdventure: (adventureId: string) => void;
  onReorderAdventures: (ids: string[]) => void;
  onExportAdventure: (adventureId: string) => void;
  onImportAdventure: () => void;

  onSelectEncounter: (id: string) => void;
  onBuildEncounter: (encounterId: string) => void;
  onPlayEncounter: (encounterId: string) => void;
  onCreateEncounter: () => void;
  onEditEncounter: (encounterId: string) => void;
  onDuplicateEncounter: (encounterId: string) => void;
  onDeleteEncounter: (encounterId: string) => void;
  onReorderEncounters: (ids: string[]) => void;
}) {
  return (
    <div className="campaignCol">
      <AdventuresPanel
        adventures={props.adventures}
        selectedAdventureId={props.selectedAdventureId}
        onSelectAdventure={props.onSelectAdventure}
        onCreate={props.onCreateAdventure}
        onEdit={props.onEditAdventure}
        onDelete={props.onDeleteAdventure}
        onReorder={props.onReorderAdventures}
        onExport={props.onExportAdventure}
        onImport={props.onImportAdventure}
      />

      <EncountersPanel
        encounters={props.encounters}
        selectedAdventureId={props.selectedAdventureId}
        selectedEncounterId={props.selectedEncounterId}
        onSelectEncounter={props.onSelectEncounter}
        onBuild={props.onBuildEncounter}
        onPlay={props.onPlayEncounter}
        onCreate={props.onCreateEncounter}
        onEdit={props.onEditEncounter}
        onDuplicate={props.onDuplicateEncounter}
        onDelete={props.onDeleteEncounter}
        onReorder={props.onReorderEncounters}
      />

      <TreasurePanel />
    </div>
  );
}
