import { useWs } from "@/services/ws";
import { api } from "@/services/api";
import { fetchCampaignCharacter, fetchCampaignCharacters, fetchEncounterActor } from "@/services/actorApi";
import { encounterPath } from "@/services/encounterApi";
import { useDebouncedTaskQueue } from "@beholden/shared/ui";
import { flattenEncounterActorDto, flattenNoteDto, flattenTreasureDto, type EncounterActorDto, type NoteDto, type TreasureDto } from "@beholden/shared/api";
import {
  fetchAdventureNotesList,
  fetchAdventureTreasureList,
  fetchNoteById,
  fetchCampaignNotesList,
  fetchCampaignTreasureList,
  fetchTreasureById,
} from "@/services/collectionApi";
import type { Adventure, CampaignCharacter, Encounter, EncounterActor, INpc, Note, TreasureEntry } from "@/domain/types/domain";
import type { Action } from "@/store/actions";
import type React from "react";

type Dispatch = React.Dispatch<Action>;

type Deps = {
  selectedCampaignId: string | null;
  selectedAdventureId: string | null;
  selectedEncounterId: string | null;
  dispatch: Dispatch;
  refreshAll: () => void;
  refreshEncounter: (encounterId: string | null) => void;
};

export function useAppWebSocket({
  selectedCampaignId,
  selectedAdventureId,
  selectedEncounterId,
  dispatch,
  refreshAll,
  refreshEncounter,
}: Deps) {
  const enqueue = useDebouncedTaskQueue();

  useWs((msg) => {
    if (msg.type === "campaigns:changed" || msg.type === "user:changed") {
      enqueue("refresh:all", async () => {
        await refreshAll();
      }, 250);
      return;
    }

    const p = msg.payload;
    const campaignId = (p && typeof p === "object") ? (p as { campaignId?: unknown }).campaignId : undefined;
    const encounterId = (p && typeof p === "object") ? (p as { encounterId?: unknown }).encounterId : undefined;

    if (msg.type === "adventures:delta" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      const payload = (p && typeof p === "object") ? (p as {
        action?: "upsert" | "delete" | "refresh";
        adventureId?: string;
      }) : {};
      if (payload.action === "delete" && payload.adventureId) {
        dispatch({ type: "removeAdventure", adventureId: payload.adventureId });
        return;
      }
      if (payload.action === "upsert" && payload.adventureId) {
        enqueue(`delta:adventure:${payload.adventureId}`, async () => {
          const adventure = await api<Adventure>(`/api/adventures/${payload.adventureId}`);
          dispatch({ type: "upsertAdventure", adventure });
        }, 80);
        return;
      }
      enqueue(`refresh:adventures:${selectedCampaignId}`, async () => {
        const adventures = await api<Adventure[]>(`/api/campaigns/${selectedCampaignId}/adventures`);
        dispatch({ type: "setAdventures", adventures });
      });
      return;
    }
    if (msg.type === "players:delta" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      const payload = (p && typeof p === "object") ? (p as {
        action?: "upsert" | "delete" | "refresh";
        playerId?: string;
      }) : {};
      if (payload.action === "delete" && payload.playerId) {
        dispatch({ type: "removePlayer", playerId: payload.playerId });
        return;
      }
      if (payload.action === "upsert" && payload.playerId) {
        enqueue(`delta:player:${payload.playerId}`, async () => {
          const player = await fetchCampaignCharacter(selectedCampaignId, payload.playerId!);
          dispatch({ type: "upsertPlayer", player: player as CampaignCharacter });
        }, 80);
        return;
      }
      enqueue(`refresh:players:${selectedCampaignId}`, async () => {
        const players = await fetchCampaignCharacters(selectedCampaignId);
        dispatch({ type: "setPlayers", players: players as CampaignCharacter[] });
      });
      return;
    }
    if (msg.type === "inpcs:delta" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      const payload = (p && typeof p === "object") ? (p as {
        action?: "upsert" | "delete" | "refresh";
        inpcId?: string;
      }) : {};
      if (payload.action === "delete" && payload.inpcId) {
        dispatch({ type: "removeINpc", inpcId: payload.inpcId });
        return;
      }
      if (payload.action === "upsert" && payload.inpcId) {
        enqueue(`delta:inpc:${payload.inpcId}`, async () => {
          const inpc = await api<INpc>(`/api/campaigns/${selectedCampaignId}/inpcs/${payload.inpcId}`);
          dispatch({ type: "upsertINpc", inpc });
        }, 80);
        return;
      }
      enqueue(`refresh:inpcs:${selectedCampaignId}`, async () => {
        const inpcs = await api<INpc[]>(`/api/campaigns/${selectedCampaignId}/inpcs`);
        dispatch({ type: "setINpcs", inpcs });
      });
      return;
    }
    if (msg.type === "encounters:delta" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      const payload = (p && typeof p === "object") ? (p as {
        action?: "upsert" | "delete" | "refresh";
        encounterId?: string;
        adventureId?: string;
      }) : {};
      if (typeof payload.adventureId !== "string" || payload.adventureId !== selectedAdventureId) return;
      if (payload.action === "delete" && payload.encounterId) {
        dispatch({ type: "removeEncounter", encounterId: payload.encounterId });
        return;
      }
      if (payload.action === "upsert" && payload.encounterId) {
        enqueue(`delta:encounter:${payload.encounterId}`, async () => {
          const encounter = await api<Encounter>(encounterPath(payload.encounterId));
          dispatch({ type: "upsertEncounter", encounter });
        }, 80);
        return;
      }
      enqueue(`refresh:encounters:${selectedAdventureId}`, async () => {
        const encounters = await api<Encounter[]>(`/api/adventures/${selectedAdventureId}/encounters`);
        dispatch({ type: "setEncounters", encounters });
      });
      return;
    }
    if (msg.type === "notes:delta" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      const payload = (p && typeof p === "object") ? (p as {
        action?: "upsert" | "delete" | "refresh";
        noteId?: string;
        adventureId?: string | null;
        note?: NoteDto;
      }) : {};
      if (payload.action === "delete" && payload.noteId) {
        if (payload.adventureId) {
          if (payload.adventureId === selectedAdventureId) {
            dispatch({ type: "removeAdventureNote", noteId: payload.noteId });
          }
        } else {
          dispatch({ type: "removeCampaignNote", noteId: payload.noteId });
        }
        return;
      }
      if (payload.action === "upsert" && payload.noteId) {
        if (payload.note && typeof payload.note === "object") {
          const flat = flattenNoteDto(payload.note as NoteDto);
          if (payload.adventureId) {
            if (payload.adventureId === selectedAdventureId) {
              dispatch({ type: "upsertAdventureNote", note: flat as Note });
            }
          } else {
            dispatch({ type: "upsertCampaignNote", note: flat as Note });
          }
          return;
        }
        enqueue(`delta:note:${payload.noteId}`, async () => {
          const note = await fetchNoteById(payload.noteId!);
          if (payload.adventureId) {
            if (payload.adventureId === selectedAdventureId) {
              dispatch({ type: "upsertAdventureNote", note: note as Note });
            }
          } else {
            dispatch({ type: "upsertCampaignNote", note: note as Note });
          }
        }, 80);
        return;
      }
      if (payload.adventureId === null) {
        enqueue(`refresh:campaign-notes:${selectedCampaignId}`, async () => {
          const notes = await fetchCampaignNotesList(selectedCampaignId);
          dispatch({ type: "setCampaignNotes", notes: notes as Note[] });
        });
      } else if (typeof payload.adventureId === "string" && payload.adventureId === selectedAdventureId) {
        enqueue(`refresh:adventure-notes:${selectedAdventureId}`, async () => {
          const notes = await fetchAdventureNotesList(selectedAdventureId);
          dispatch({ type: "setAdventureNotes", notes });
        });
      }
      return;
    }
    if (msg.type === "treasure:delta" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      const payload = (p && typeof p === "object") ? (p as {
        action?: "upsert" | "delete" | "refresh";
        treasureId?: string;
        adventureId?: string | null;
        treasure?: TreasureDto;
      }) : {};
      if (payload.action === "delete" && payload.treasureId) {
        if (payload.adventureId) {
          if (payload.adventureId === selectedAdventureId) {
            dispatch({ type: "removeAdventureTreasure", treasureId: payload.treasureId });
          }
        } else {
          dispatch({ type: "removeCampaignTreasure", treasureId: payload.treasureId });
        }
        return;
      }
      if (payload.action === "upsert" && payload.treasureId) {
        if (payload.treasure && typeof payload.treasure === "object") {
          const flat = flattenTreasureDto(payload.treasure as TreasureDto);
          if (payload.adventureId) {
            if (payload.adventureId === selectedAdventureId) {
              dispatch({ type: "upsertAdventureTreasure", entry: flat as TreasureEntry });
            }
          } else {
            dispatch({ type: "upsertCampaignTreasure", entry: flat as TreasureEntry });
          }
          return;
        }
        enqueue(`delta:treasure:${payload.treasureId}`, async () => {
          const entry = await fetchTreasureById(payload.treasureId!);
          if (payload.adventureId) {
            if (payload.adventureId === selectedAdventureId) {
              dispatch({ type: "upsertAdventureTreasure", entry: entry as TreasureEntry });
            }
          } else {
            dispatch({ type: "upsertCampaignTreasure", entry: entry as TreasureEntry });
          }
        }, 80);
        return;
      }
      if (payload.adventureId === null) {
        enqueue(`refresh:campaign-treasure:${selectedCampaignId}`, async () => {
          const treasure = await fetchCampaignTreasureList(selectedCampaignId);
          dispatch({ type: "setCampaignTreasure", treasure: treasure as TreasureEntry[] });
        });
      } else if (typeof payload.adventureId === "string" && payload.adventureId === selectedAdventureId) {
        enqueue(`refresh:adventure-treasure:${selectedAdventureId}`, async () => {
          const treasure = await fetchAdventureTreasureList(selectedAdventureId);
          dispatch({ type: "setAdventureTreasure", treasure: treasure as TreasureEntry[] });
        });
      }
      return;
    }
    if (msg.type === "encounter:combatantsDelta" && typeof encounterId === "string" && encounterId === selectedEncounterId) {
      const payload = (p && typeof p === "object") ? (p as {
        action?: "upsert" | "delete" | "refresh";
        combatantId?: string;
        combatant?: EncounterActorDto;
      }) : {};
      if (payload.action === "delete" && payload.combatantId) {
        dispatch({ type: "removeCombatant", combatantId: payload.combatantId });
        return;
      }
      if (payload.action === "upsert" && payload.combatantId) {
        if (payload.combatant && typeof payload.combatant === "object") {
          dispatch({
            type: "upsertCombatant",
            combatant: flattenEncounterActorDto(payload.combatant) as EncounterActor,
          });
          return;
        }
        enqueue(`delta:combatant:${payload.combatantId}`, async () => {
          const combatant = await fetchEncounterActor(selectedEncounterId, payload.combatantId!);
          dispatch({ type: "upsertCombatant", combatant: combatant as EncounterActor });
        }, 80);
        return;
      }
      enqueue(`refresh:encounter:${selectedEncounterId}`, async () => {
        await refreshEncounter(selectedEncounterId);
      }, 100);
      return;
    }
  });
}
