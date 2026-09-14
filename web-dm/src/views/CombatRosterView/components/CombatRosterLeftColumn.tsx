import type { WorkspacePanel } from "@/layout/workspace/DmWorkspace";
import type { EncounterActor, CampaignCharacter } from "@/domain/types/domain";
import type { AddMonsterOptions, INpc } from "@/domain/types/domain";

import { PlayersPanel } from "@/views/CampaignView/panels/PlayersPanel";
import { INpcsPanel } from "@/views/CampaignView/panels/INpcsPanel";

type Props = {
  players: CampaignCharacter[];
  combatants: EncounterActor[];
  inpcs: INpc[];
  selectedCampaignId: string;
  selectedEncounterId: string | null;
  onFullRest: () => Promise<void>;
  onCreatePlayer: () => void;
  onEditPlayer: (playerId: string) => void;
  onDeletePlayer: (playerId: string) => void;
  onAddPlayerToEncounter: (playerId: string) => Promise<void>;
  onAddINpcFromMonster: (
    monsterId: string,
    qty: number,
    opts?: AddMonsterOptions,
  ) => Promise<void>;
  onEditINpc: (inpcId: string) => void;
  onDeleteINpc: (inpcId: string) => void;
  onAddINpcToEncounter: (inpcId: string) => Promise<void>;
};

export function buildRosterLeftPanels(props: Props) {
  return [
    {
      id: "players",
      title: "Players",
      column: 0,
      content: (
        <PlayersPanel
          players={props.players}
          combatants={props.combatants}
          selectedEncounterId={props.selectedEncounterId}
          onFullRest={props.onFullRest}
          onCreatePlayer={props.onCreatePlayer}
          onEditPlayer={props.onEditPlayer}
          onDeletePlayer={props.onDeletePlayer}
          onAddPlayerToEncounter={props.onAddPlayerToEncounter}
        />
      ),
    },
    {
      id: "party-npcs",
      title: "Party NPCs",
      column: 0,
      content: (
        <INpcsPanel
          inpcs={props.inpcs}
          selectedCampaignId={props.selectedCampaignId}
          selectedEncounterId={props.selectedEncounterId}
          onAddINpcFromMonster={props.onAddINpcFromMonster}
          onEditINpc={props.onEditINpc}
          onDeleteINpc={props.onDeleteINpc}
          onAddINpcToEncounter={props.onAddINpcToEncounter}
        />
      ),
    },
  ] satisfies WorkspacePanel[];
}
