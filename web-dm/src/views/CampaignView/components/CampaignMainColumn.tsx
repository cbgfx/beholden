import React from "react";
import type { AddMonsterOptions } from "@/domain/types/domain";
import { PlayersPanel } from "@/views/CampaignView/panels/PlayersPanel";
import { INpcsPanel } from "@/views/CampaignView/panels/INpcsPanel";
import type { Combatant, Player, INpc } from "@/domain/types/domain";


export function CampaignMainColumn(props: {
  players: CampaignCharacter[];
  combatants: EncounterActor[];
  inpcs: INpc[];
  selectedEncounterId: string | null;
  onFullRest: () => void;
  onCreatePlayer: () => void;
  onEditPlayer: (playerId: string) => void;
  onDeletePlayer: (playerId: string) => void;
  onAddPlayerToEncounter: (playerId: string) => void;
  selectedCampaignId: string | null;
  onAddINpcFromMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
  onEditINpc: (inpcId: string) => void;
  onDeleteINpc: (inpcId: string) => void;
  onAddINpcToEncounter: (inpcId: string) => void;
}) {
  return (
    <div className="campaignCol campaignColMain">
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

      <INpcsPanel
        inpcs={props.inpcs}
        selectedCampaignId={props.selectedCampaignId}
        selectedEncounterId={props.selectedEncounterId}
        onAddINpcFromMonster={props.onAddINpcFromMonster}
        onEditINpc={props.onEditINpc}
        onDeleteINpc={props.onDeleteINpc}
        onAddINpcToEncounter={props.onAddINpcToEncounter}
      />
    </div>
  );
}
