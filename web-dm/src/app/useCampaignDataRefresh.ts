// web-dm/src/app/useCampaignDataRefresh.ts
// Cascading campaign/adventure/encounter data loaders, each aborting its own in-flight request
// before starting a new one so a fast campaign/adventure/encounter switch can't let a stale
// response land after a newer one.
import { useCallback, useEffect, useRef } from "react";
import type { Dispatch } from "react";
import { api } from "@/services/api";
import { fetchEncounterActors } from "@/services/actorApi";
import { fetchCampaignBootstrap } from "@/services/campaignBootstrapApi";
import { fetchAdventureNotesList, fetchAdventureTreasureList } from "@/services/collectionApi";
import type { Encounter, EncounterActor, Note, TreasureEntry } from "@/domain/types/domain";
import type { Action } from "@/store/actions";

export function useCampaignDataRefresh(dispatch: Dispatch<Action>) {
  const campaignRequestRef = useRef<AbortController | null>(null);
  const adventureRequestRef = useRef<AbortController | null>(null);
  const encounterRequestRef = useRef<AbortController | null>(null);

  const refreshCampaign = useCallback(async (cid: string) => {
    if (!cid) return;
    campaignRequestRef.current?.abort();
    const controller = new AbortController();
    campaignRequestRef.current = controller;
    let data: Awaited<ReturnType<typeof fetchCampaignBootstrap>>;
    try {
      data = await fetchCampaignBootstrap(cid, controller.signal);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    } finally {
      if (campaignRequestRef.current === controller) campaignRequestRef.current = null;
    }
    if (controller.signal.aborted) return;
    dispatch({ type: "setAdventures", adventures: data.adventures });
    dispatch({ type: "setPlayers", players: data.players });
    dispatch({ type: "setINpcs", inpcs: data.inpcs });
    dispatch({ type: "setCampaignNotes", notes: data.notes });
    dispatch({ type: "setCampaignTreasure", treasure: data.treasure });
  }, [dispatch]);

  const refreshAdventure = useCallback(async (adventureId: string | null) => {
    adventureRequestRef.current?.abort();
    if (!adventureId) {
      dispatch({ type: "setEncounters", encounters: [] });
      dispatch({ type: "setAdventureNotes", notes: [] });
      dispatch({ type: "setAdventureTreasure", treasure: [] });
      return;
    }
    const controller = new AbortController();
    adventureRequestRef.current = controller;
    let result: [Encounter[], Note[], TreasureEntry[]];
    try {
      result = await Promise.all([
        api<Encounter[]>(`/api/adventures/${adventureId}/encounters`, { signal: controller.signal }),
        fetchAdventureNotesList(adventureId, controller.signal) as Promise<Note[]>,
        fetchAdventureTreasureList(adventureId, controller.signal) as Promise<TreasureEntry[]>,
      ]);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      throw error;
    } finally {
      if (adventureRequestRef.current === controller) adventureRequestRef.current = null;
    }
    if (controller.signal.aborted) return;
    const [enc, notes, treasure] = result;
    dispatch({ type: "setEncounters", encounters: enc });
    dispatch({ type: "setAdventureNotes", notes });
    dispatch({ type: "setAdventureTreasure", treasure });
  }, [dispatch]);

  const refreshEncounter = useCallback(async (encounterId: string | null) => {
    encounterRequestRef.current?.abort();
    if (!encounterId) { dispatch({ type: "setCombatants", combatants: [] }); return; }
    const controller = new AbortController();
    encounterRequestRef.current = controller;
    try {
      const combatants = await fetchEncounterActors(encounterId, controller.signal) as EncounterActor[];
      if (!controller.signal.aborted) dispatch({ type: "setCombatants", combatants });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    } finally {
      if (encounterRequestRef.current === controller) encounterRequestRef.current = null;
    }
  }, [dispatch]);

  useEffect(() => () => {
    campaignRequestRef.current?.abort();
    adventureRequestRef.current?.abort();
    encounterRequestRef.current?.abort();
  }, []);

  return { refreshCampaign, refreshAdventure, refreshEncounter };
}
