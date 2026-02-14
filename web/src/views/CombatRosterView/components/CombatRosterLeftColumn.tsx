import * as React from "react";

import type { AddMonsterOptions, INpc } from "@/domain/types/domain";

import { PlayersPanel } from "@/views/CampaignView/panels/PlayersPanel";
import { INpcsPanel } from "@/views/CampaignView/panels/INpcsPanel";

type Props = {
  players: any[];
  combatants: any[] | null;
  inpcs: INpc[];
  selectedCampaignId: string;
  selectedEncounterId: string | null;
  compQ: string;
  onChangeCompQ: (q: string) => void;
  onFullRest: () => Promise<void>;
  onCreatePlayer: () => void;
  onEditPlayer: (playerId: string) => void;
  onAddPlayerToEncounter: (playerId: string) => Promise<void>;
  onAddINpcFromMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => Promise<void>;
  onEditINpc: (inpcId: string) => void;
  onDeleteINpc: (inpcId: string) => Promise<void>;
  onAddINpcToEncounter: (inpcId: string) => Promise<void>;
};

export function CombatRosterLeftColumn(props: Props) {
  return (
    <div className="campaignCol">
      <PlayersPanel
        players={props.players}
        combatants={props.combatants}
        selectedEncounterId={props.selectedEncounterId}
        onFullRest={props.onFullRest}
        onCreatePlayer={props.onCreatePlayer}
        onEditPlayer={props.onEditPlayer}
        onAddPlayerToEncounter={props.onAddPlayerToEncounter}
      />

      <INpcsPanel
        inpcs={props.inpcs}
        selectedCampaignId={props.selectedCampaignId}
        selectedEncounterId={props.selectedEncounterId}
        compQ={props.compQ}
        onChangeCompQ={props.onChangeCompQ}
        // Let the iNPC panel reuse the MonsterPickerModal's internal compendium loading.
        compRows={[]}
        onAddINpcFromMonster={props.onAddINpcFromMonster}
        onEditINpc={props.onEditINpc}
        onDeleteINpc={props.onDeleteINpc}
        onAddINpcToEncounter={props.onAddINpcToEncounter}
      />
    </div>
  );
}
