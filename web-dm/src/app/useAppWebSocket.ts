import { useWs } from "@/services/ws";
import { api } from "@/services/api";
import { fetchCampaignCharacters } from "@/services/actorApi";
import {
  fetchAdventureTreasure,
  fetchCampaignNotes,
  fetchCampaignTreasure,
} from "@/services/collectionApi";
import type { CampaignCharacter, INpc, Note, TreasureEntry } from "@/domain/types/domain";
import type { CompendiumMonsterRow } from "@/views/CampaignView/monsterPicker/types";
import type { Action } from "@/store/actions";
import type React from "react";

type Dispatch = React.Dispatch<Action>;

type Deps = {
  selectedCampaignId: string | null;
  selectedAdventureId: string | null;
  selectedEncounterId: string | null;
  dispatch: Dispatch;
  refreshAll: () => void;
  refreshCampaign: (cid: string) => void;
  refreshAdventure: (adventureId: string | null) => void;
  refreshEncounter: (encounterId: string | null) => void;
  setCompendiumIndex: (rows: CompendiumMonsterRow[]) => void;
};

export function useAppWebSocket({
  selectedCampaignId,
  selectedAdventureId,
  selectedEncounterId,
  dispatch,
  refreshAll,
  refreshCampaign,
  refreshAdventure,
  refreshEncounter,
  setCompendiumIndex,
}: Deps) {
  useWs((msg) => {
    if (msg.type === "campaigns:changed" || msg.type === "user:changed") { refreshAll(); return; }

    const p = msg.payload;
    const campaignId = (p && typeof p === "object") ? (p as { campaignId?: unknown }).campaignId : undefined;
    const encounterId = (p && typeof p === "object") ? (p as { encounterId?: unknown }).encounterId : undefined;

    if (msg.type === "adventures:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      refreshCampaign(selectedCampaignId); return;
    }
    if (msg.type === "players:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      fetchCampaignCharacters(selectedCampaignId).then((pls) => dispatch({ type: "setPlayers", players: pls as CampaignCharacter[] }));
      return;
    }
    if (msg.type === "inpcs:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      api<INpc[]>(`/api/campaigns/${selectedCampaignId}/inpcs`).then((inpcs) => dispatch({ type: "setINpcs", inpcs }));
      return;
    }
    if (msg.type === "encounters:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      if (selectedAdventureId) refreshAdventure(selectedAdventureId);
      return;
    }
    if (msg.type === "notes:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      fetchCampaignNotes(selectedCampaignId).then((notes) => dispatch({ type: "setCampaignNotes", notes: notes as Note[] }));
      if (selectedAdventureId) refreshAdventure(selectedAdventureId);
      return;
    }
    if (msg.type === "treasure:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      fetchCampaignTreasure(selectedCampaignId).then((treasure) => dispatch({ type: "setCampaignTreasure", treasure: treasure as TreasureEntry[] }));
      if (selectedAdventureId) {
        fetchAdventureTreasure(selectedAdventureId).then((treasure) => dispatch({ type: "setAdventureTreasure", treasure: treasure as TreasureEntry[] }));
      } else {
        dispatch({ type: "setAdventureTreasure", treasure: [] });
      }
      return;
    }
    if (msg.type === "encounter:combatantsChanged" && typeof encounterId === "string" && encounterId === selectedEncounterId) {
      refreshEncounter(selectedEncounterId); return;
    }
    if (msg.type === "compendium:changed") {
      api<CompendiumMonsterRow[]>(`/api/compendium/monsters`).then(setCompendiumIndex);
      return;
    }
  });
}
