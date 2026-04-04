import { useWs } from "@/services/ws";
import { api } from "@/services/api";
import type { INpc, Note, Player, TreasureEntry } from "@/domain/types/domain";
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
      api<CampaignCharacter[]>(`/api/campaigns/${selectedCampaignId}/players`).then((pls) => dispatch({ type: "setPlayers", players: pls }));
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
      api<Note[]>(`/api/campaigns/${selectedCampaignId}/notes`).then((notes) => dispatch({ type: "setCampaignNotes", notes }));
      if (selectedAdventureId) refreshAdventure(selectedAdventureId);
      return;
    }
    if (msg.type === "treasure:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      api<TreasureEntry[]>(`/api/campaigns/${selectedCampaignId}/treasure`).then((treasure) => dispatch({ type: "setCampaignTreasure", treasure }));
      if (selectedAdventureId) {
        api<TreasureEntry[]>(`/api/adventures/${selectedAdventureId}/treasure`).then((treasure) => dispatch({ type: "setAdventureTreasure", treasure }));
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
