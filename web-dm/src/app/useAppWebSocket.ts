import { useWs } from "@/services/ws";
import { api } from "@/services/api";
import { fetchCampaignCharacters } from "@/services/actorApi";
import {
  fetchAdventureTreasure,
  fetchNoteById,
  fetchCampaignNotes,
  fetchCampaignTreasure,
  fetchTreasureById,
} from "@/services/collectionApi";
import type { CampaignCharacter, INpc, Note, TreasureEntry } from "@/domain/types/domain";
import type { Action } from "@/store/actions";
import React from "react";

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
}: Deps) {
  const taskStateRef = React.useRef(
    new Map<string, { timer: number | null; inflight: boolean; pending: boolean }>()
  );

  React.useEffect(() => {
    return () => {
      for (const state of taskStateRef.current.values()) {
        if (state.timer != null) window.clearTimeout(state.timer);
      }
      taskStateRef.current.clear();
    };
  }, []);

  const enqueue = React.useCallback((key: string, run: () => Promise<void> | void, delayMs = 150) => {
    let state = taskStateRef.current.get(key);
    if (!state) {
      state = { timer: null, inflight: false, pending: false };
      taskStateRef.current.set(key, state);
    }

    if (state.timer != null) window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => {
      state!.timer = null;
      const execute = () => {
        if (state!.inflight) {
          state!.pending = true;
          return;
        }

        state!.inflight = true;
        Promise.resolve(run())
          .catch(() => {})
          .finally(() => {
            state!.inflight = false;
            if (state!.pending) {
              state!.pending = false;
              execute();
            }
          });
      };
      execute();
    }, delayMs);
  }, []);

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

    if (msg.type === "adventures:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      enqueue(`refresh:campaign:${selectedCampaignId}`, async () => {
        await refreshCampaign(selectedCampaignId);
      });
      return;
    }
    if (msg.type === "players:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      enqueue(`refresh:players:${selectedCampaignId}`, async () => {
        const players = await fetchCampaignCharacters(selectedCampaignId);
        dispatch({ type: "setPlayers", players: players as CampaignCharacter[] });
      });
      return;
    }
    if (msg.type === "inpcs:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      enqueue(`refresh:inpcs:${selectedCampaignId}`, async () => {
        const inpcs = await api<INpc[]>(`/api/campaigns/${selectedCampaignId}/inpcs`);
        dispatch({ type: "setINpcs", inpcs });
      });
      return;
    }
    if (msg.type === "encounters:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      if (selectedAdventureId) {
        enqueue(`refresh:adventure:${selectedAdventureId}`, async () => {
          await refreshAdventure(selectedAdventureId);
        });
      }
      return;
    }
    if (msg.type === "notes:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      enqueue(`refresh:campaign-notes:${selectedCampaignId}`, async () => {
        const notes = await fetchCampaignNotes(selectedCampaignId);
        dispatch({ type: "setCampaignNotes", notes: notes as Note[] });
      });
      if (selectedAdventureId) {
        enqueue(`refresh:adventure:${selectedAdventureId}`, async () => {
          await refreshAdventure(selectedAdventureId);
        });
      }
      return;
    }
    if (msg.type === "notes:delta" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      const payload = (p && typeof p === "object") ? (p as {
        action?: "upsert" | "delete" | "refresh";
        noteId?: string;
        adventureId?: string | null;
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
    }
    if (msg.type === "treasure:changed" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      enqueue(`refresh:campaign-treasure:${selectedCampaignId}`, async () => {
        const treasure = await fetchCampaignTreasure(selectedCampaignId);
        dispatch({ type: "setCampaignTreasure", treasure: treasure as TreasureEntry[] });
      });
      if (selectedAdventureId) {
        enqueue(`refresh:adventure-treasure:${selectedAdventureId}`, async () => {
          const treasure = await fetchAdventureTreasure(selectedAdventureId);
          dispatch({ type: "setAdventureTreasure", treasure: treasure as TreasureEntry[] });
        });
      } else {
        dispatch({ type: "setAdventureTreasure", treasure: [] });
      }
      return;
    }
    if (msg.type === "treasure:delta" && typeof campaignId === "string" && campaignId === selectedCampaignId) {
      const payload = (p && typeof p === "object") ? (p as {
        action?: "upsert" | "delete" | "refresh";
        treasureId?: string;
        adventureId?: string | null;
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
    }
    if (msg.type === "encounter:combatantsChanged" && typeof encounterId === "string" && encounterId === selectedEncounterId) {
      enqueue(`refresh:encounter:${selectedEncounterId}`, async () => {
        await refreshEncounter(selectedEncounterId);
      }, 100);
      return;
    }
  });
}
