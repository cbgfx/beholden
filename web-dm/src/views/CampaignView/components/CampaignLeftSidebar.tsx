import type { WorkspacePanel } from "@/layout/workspace/DmWorkspace";
import { AdventuresPanel } from "@/views/CampaignView/panels/AdventuresPanel";
import { EncountersPanel } from "@/views/CampaignView/panels/EncountersPanel";
import { TreasurePanel } from "@/components/treasure/TreasurePanel";
import type { Adventure } from "@/domain/types/domain";

export function buildCampaignLeftPanels(props: {
  adventures: Adventure[];
  selectedAdventureId: string | null;
  encounters: { id: string; name: string; status: string }[];
  selectedEncounterId: string | null;
  selectedEncounterCounts: {
    players: number;
    friendlies: number;
    hostiles: number;
  } | null;

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
  return [
    {
      id: "adventures",
      title: "Adventures",
      column: 0,
      content: (
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
      ),
    },
    {
      id: "encounters",
      title: "Encounters",
      column: 0,
      content: (
        <EncountersPanel
          encounters={props.encounters}
          selectedAdventureId={props.selectedAdventureId}
          selectedEncounterId={props.selectedEncounterId}
          selectedEncounterCounts={props.selectedEncounterCounts}
          onSelectEncounter={props.onSelectEncounter}
          onBuild={props.onBuildEncounter}
          onPlay={props.onPlayEncounter}
          onCreate={props.onCreateEncounter}
          onEdit={props.onEditEncounter}
          onDuplicate={props.onDuplicateEncounter}
          onDelete={props.onDeleteEncounter}
          onReorder={props.onReorderEncounters}
        />
      ),
    },
    {
      id: "treasure",
      title: "Treasure",
      column: 0,
      content: <TreasurePanel />,
    },
  ] satisfies WorkspacePanel[];
}
