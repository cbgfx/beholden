import React from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store";
import type { AddMonsterOptions } from "@/domain/types/domain";
import type { CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";
import { useOpenEncounterMetrics } from "@/views/CampaignView/hooks/useOpenEncounterMetrics";
import { CampaignLeftSidebar } from "@/views/CampaignView/components/CampaignLeftSidebar";
import { CampaignMainColumn } from "@/views/CampaignView/components/CampaignMainColumn";
import { CampaignRightSidebar } from "@/views/CampaignView/components/CampaignRightSidebar";

export function CampaignView(props: {
  onCreateAdventure: () => void;
  onCreateEncounter: () => void;

  onEditAdventure: (adventureId: string) => void;
  onDeleteAdventure: (adventureId: string) => void;

  onEditEncounter: (encounterId: string) => void;
  onDuplicateEncounter: (encounterId: string) => void;
  onDeleteEncounter: (encounterId: string) => void;

  onAddCampaignNote: () => void;
  onAddAdventureNote: () => void;
  onEditCampaignNote: (noteId: string) => void;
  onDeleteCampaignNote: (noteId: string) => void;
  onEditAdventureNote: (noteId: string) => void;
  onDeleteAdventureNote: (noteId: string) => void;
  onFullRest: () => void;
  onCreatePlayer: () => void;
  onEditPlayer: (playerId: string) => void;
  onDeletePlayer: (playerId: string) => void;
  onAddPlayerToEncounter: (playerId: string) => void;

  onAddINpcFromMonster: (monsterId: string, qty: number, opts?: AddMonsterOptions) => void;
  onEditINpc: (inpcId: string) => void;
  onDeleteINpc: (inpcId: string) => void;
  onAddINpcToEncounter: (inpcId: string) => void;
  onReorderAdventures: (ids: string[]) => void;
  onReorderEncounters: (ids: string[]) => void;
  onExportAdventure: (adventureId: string) => void;
  onImportAdventure: () => void;
  onReorderCampaignNotes: (ids: string[]) => void;
  onReorderAdventureNotes: (ids: string[]) => void;

  compQ: string;
  setCompQ: (v: string) => void;
  compRows: CompendiumMonsterRow[];
}) {
  const { state, dispatch } = useStore();
  const nav = useNavigate();

  const {
    adventures,
    selectedAdventureId,
    encounters,
    selectedEncounterId,
    players,
    inpcs,
    combatants,
    campaignNotes,
    adventureNotes,
    expandedNoteIds,
  } = state;

  const selectedCampaign = state.campaigns.find((c) => c.id === state.selectedCampaignId);
  const campaignSharedNotes = selectedCampaign?.sharedNotes ?? "";

  const selectedEncounter = React.useMemo(() => {
    return encounters.find((e) => e.id === selectedEncounterId) ?? null;
  }, [encounters, selectedEncounterId]);

  const { encountersForPanel } = useOpenEncounterMetrics({
    encounters,
    players,
    inpcs,
    monsterDetails: state.monsterDetails,
    dispatch,
  });

  return (
    <div className="campaignGrid">
      {/* LEFT SIDEBAR */}
      <CampaignLeftSidebar
        adventures={adventures}
        selectedAdventureId={selectedAdventureId}
        encounters={encountersForPanel}
        selectedEncounterId={selectedEncounterId}
        onSelectAdventure={(id) =>
          dispatch({
            type: "selectAdventure",
            adventureId: id === selectedAdventureId ? null : id,
          })
        }
        onCreateAdventure={props.onCreateAdventure}
        onEditAdventure={props.onEditAdventure}
        onDeleteAdventure={props.onDeleteAdventure}
        onReorderAdventures={props.onReorderAdventures}
        onExportAdventure={props.onExportAdventure}
        onImportAdventure={props.onImportAdventure}
        onSelectEncounter={(id) =>
          dispatch({
            type: "selectEncounter",
            encounterId: id === selectedEncounterId ? null : id,
          })
        }
        onBuildEncounter={(id) =>
          state.selectedCampaignId ? nav(`/campaign/${state.selectedCampaignId}/roster/${id}`) : nav(`/roster/${id}`)
        }
        onPlayEncounter={(id) =>
          state.selectedCampaignId ? nav(`/campaign/${state.selectedCampaignId}/combat/${id}`) : nav(`/combat/${id}`)
        }
        onCreateEncounter={props.onCreateEncounter}
        onEditEncounter={props.onEditEncounter}
        onDuplicateEncounter={props.onDuplicateEncounter}
        onDeleteEncounter={props.onDeleteEncounter}
        onReorderEncounters={props.onReorderEncounters}
      />

      {/* MAIN COLUMN */}
      <CampaignMainColumn
        players={players}
        combatants={combatants}
        selectedEncounterId={selectedEncounter ? selectedEncounter.id : null}
        onFullRest={props.onFullRest}
        onCreatePlayer={props.onCreatePlayer}
        onEditPlayer={props.onEditPlayer}
        onDeletePlayer={props.onDeletePlayer}
        onAddPlayerToEncounter={props.onAddPlayerToEncounter}
        inpcs={inpcs}
        selectedCampaignId={state.selectedCampaignId}
        compQ={props.compQ}
        onChangeCompQ={props.setCompQ}
        compRows={props.compRows}
        onAddINpcFromMonster={props.onAddINpcFromMonster}
        onEditINpc={props.onEditINpc}
        onDeleteINpc={props.onDeleteINpc}
        onAddINpcToEncounter={props.onAddINpcToEncounter}
      />

      {/* RIGHT SIDEBAR */}
      <CampaignRightSidebar
        selectedAdventureId={selectedAdventureId}
        campaignNotes={campaignNotes}
        adventureNotes={adventureNotes}
        expandedNoteIds={expandedNoteIds}
        onToggleNote={(noteId) => dispatch({ type: "toggleNote", noteId })}
        players={players}
        campaignId={state.selectedCampaignId}
        campaignSharedNotes={campaignSharedNotes}
        onAddCampaignNote={props.onAddCampaignNote}
        onEditCampaignNote={props.onEditCampaignNote}
        onDeleteCampaignNote={props.onDeleteCampaignNote}
        onReorderCampaignNotes={props.onReorderCampaignNotes}
        onAddAdventureNote={props.onAddAdventureNote}
        onEditAdventureNote={props.onEditAdventureNote}
        onDeleteAdventureNote={props.onDeleteAdventureNote}
        onReorderAdventureNotes={props.onReorderAdventureNotes}
      />
    </div>
  );
}
