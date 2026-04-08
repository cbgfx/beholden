import React from "react";
import { api, jsonInit } from "@/services/api";
import type { AddMonsterOptions } from "@/domain/types/domain";
import type { State } from "@/store/state";
import type { Action } from "@/store/actions";
import type { ConfirmOptions } from "@/confirm/ConfirmContext";

type Dispatch = React.Dispatch<Action>;
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

type RefreshFns = {
  refreshAll: () => Promise<void>;
  refreshCampaign: (cid: string) => Promise<void>;
  refreshAdventure: (adventureId: string | null) => Promise<void>;
  refreshEncounter: (encounterId: string | null) => Promise<void>;
};

function apiErr(e: unknown) {
  alert(e instanceof Error ? e.message : "Something went wrong. Please try again.");
}

export function useCampaignActions(
  state: State,
  dispatch: Dispatch,
  confirm: ConfirmFn,
  { refreshAll, refreshCampaign, refreshAdventure, refreshEncounter }: RefreshFns
) {
  const addAllPlayers = React.useCallback(async () => {
    if (!state.selectedEncounterId) return;
    try {
      await api(`/api/encounters/${state.selectedEncounterId}/combatants/addPlayers`, { method: "POST" });
      await refreshEncounter(state.selectedEncounterId);
    } catch (e) { apiErr(e); }
  }, [state.selectedEncounterId, refreshEncounter]);

  const addPlayerToEncounter = React.useCallback(async (playerId: string) => {
    if (!state.selectedEncounterId) return;
    try {
      await api(`/api/encounters/${state.selectedEncounterId}/combatants/addPlayer`, jsonInit("POST", { playerId }));
      await refreshEncounter(state.selectedEncounterId);
    } catch (e) { apiErr(e); }
  }, [state.selectedEncounterId, refreshEncounter]);

  const fullRestPlayers = React.useCallback(async () => {
    if (!state.selectedCampaignId) return;
    try {
      await api(`/api/campaigns/${state.selectedCampaignId}/fullRest`, { method: "POST" });
      await refreshCampaign(state.selectedCampaignId);
      if (state.selectedEncounterId) await refreshEncounter(state.selectedEncounterId);
    } catch (e) { apiErr(e); }
  }, [state.selectedCampaignId, state.selectedEncounterId, refreshCampaign, refreshEncounter]);

  const reorder = React.useCallback(async (url: string, ids: string[], refresh: () => Promise<void>) => {
    try {
      await api(url, jsonInit("POST", { ids }));
      await refresh();
    } catch (e) { apiErr(e); }
  }, []);

  const reorderAdventures = React.useCallback((ids: string[]) => {
    if (!state.selectedCampaignId) return;
    return reorder(
      `/api/campaigns/${state.selectedCampaignId}/adventures/reorder`,
      ids,
      () => refreshCampaign(state.selectedCampaignId)
    );
  }, [state.selectedCampaignId, reorder, refreshCampaign]);

  const reorderEncounters = React.useCallback((ids: string[]) => {
    if (!state.selectedAdventureId) return;
    return reorder(
      `/api/adventures/${state.selectedAdventureId}/encounters/reorder`,
      ids,
      () => refreshAdventure(state.selectedAdventureId)
    );
  }, [state.selectedAdventureId, reorder, refreshAdventure]);

  const reorderCampaignNotes = React.useCallback((ids: string[]) => {
    if (!state.selectedCampaignId) return;
    return reorder(
      `/api/campaigns/${state.selectedCampaignId}/notes/reorder`,
      ids,
      () => refreshCampaign(state.selectedCampaignId)
    );
  }, [state.selectedCampaignId, reorder, refreshCampaign]);

  const reorderAdventureNotes = React.useCallback((ids: string[]) => {
    if (!state.selectedAdventureId) return;
    return reorder(
      `/api/adventures/${state.selectedAdventureId}/notes/reorder`,
      ids,
      () => refreshAdventure(state.selectedAdventureId)
    );
  }, [state.selectedAdventureId, reorder, refreshAdventure]);

  const addMonster = React.useCallback(async (monsterId: string, qty: number, opts?: AddMonsterOptions) => {
    if (!state.selectedEncounterId) return;
    try {
      await api(`/api/encounters/${state.selectedEncounterId}/combatants/addMonster`, jsonInit("POST", {
        monsterId,
        qty,
        friendly: Boolean(opts?.friendly ?? false),
        labelBase: opts?.labelBase?.trim() || undefined,
        ac: opts?.ac,
        acDetail: opts?.acDetails ?? undefined,
        hpMax: opts?.hpMax,
        hpDetail: opts?.hpDetails ?? undefined,
        attackOverrides: opts?.attackOverrides ?? null
      }));
      await refreshEncounter(state.selectedEncounterId);
    } catch (e) { apiErr(e); }
  }, [state.selectedEncounterId, refreshEncounter]);

  const removeCombatant = React.useCallback(async (combatantId: string) => {
    if (!state.selectedEncounterId) return;
    try {
      await api(`/api/encounters/${state.selectedEncounterId}/combatants/${combatantId}`, { method: "DELETE" });
      await refreshEncounter(state.selectedEncounterId);
    } catch (e) { apiErr(e); }
  }, [state.selectedEncounterId, refreshEncounter]);

  const addINpcFromMonster = React.useCallback(async (monsterId: string, qty: number, opts?: AddMonsterOptions) => {
    if (!state.selectedCampaignId) return;
    try {
      await api(`/api/campaigns/${state.selectedCampaignId}/inpcs`, jsonInit("POST", {
        monsterId,
        qty,
        name: opts?.labelBase ?? null,
        friendly: Boolean(opts?.friendly ?? true),
        ac: opts?.ac ?? null,
        acDetails: opts?.acDetails ?? null,
        hpMax: opts?.hpMax ?? null,
        hpDetails: opts?.hpDetails ?? null
      }));
      await refreshCampaign(state.selectedCampaignId);
    } catch (e) { apiErr(e); }
  }, [state.selectedCampaignId, refreshCampaign]);

  const deletePlayer = React.useCallback(async (playerId: string) => {
    if (!state.selectedCampaignId) return;
    const player = state.players.find((p) => p.id === playerId);
    const isWebPlayer = Boolean(player?.userId);
    const title = isWebPlayer ? "Remove from Campaign" : "Delete Character";
    const message = isWebPlayer
      ? "Remove this character from the campaign? They can re-join later."
      : "Delete this character? This cannot be undone.";
    if (!(await confirm({ title, message, intent: "danger" }))) return;
    try {
      await api(`/api/players/${playerId}`, { method: "DELETE" });
      await refreshCampaign(state.selectedCampaignId);
    } catch (e) { apiErr(e); }
  }, [state.selectedCampaignId, state.players, confirm, refreshCampaign]);

  const deleteINpc = React.useCallback(async (inpcId: string) => {
    if (!state.selectedCampaignId) return;
    if (!(await confirm({ title: "Delete iNPC", message: "Delete this iNPC?", intent: "danger" }))) return;
    try {
      await api(`/api/inpcs/${inpcId}`, { method: "DELETE" });
      await refreshCampaign(state.selectedCampaignId);
    } catch (e) { apiErr(e); }
  }, [state.selectedCampaignId, confirm, refreshCampaign]);

  const exportAdventure = React.useCallback(async (adventureId: string) => {
    try {
      const data = await api<unknown>(`/api/adventures/${adventureId}/export`);
      const adv = state.adventures.find((a) => a.id === adventureId);
      const slug = (adv?.name ?? "adventure")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slug}.adventure.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) { apiErr(e); }
  }, [state.adventures]);

  const handleImportAdventureFile = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !state.selectedCampaignId) return;
    e.target.value = "";
    let data: unknown;
    try { data = JSON.parse(await file.text()); }
    catch { alert("Invalid adventure file."); return; }
    if (typeof data !== "object" || data === null || !("version" in data)) {
      alert("Invalid adventure file."); return;
    }
    if ((data as { version: unknown }).version !== 1) {
      alert("Adventure file version not supported."); return;
    }
    try {
      await api(
        `/api/campaigns/${state.selectedCampaignId}/adventures/import`,
        jsonInit("POST", data)
      );
      await refreshCampaign(state.selectedCampaignId);
    } catch (e) { apiErr(e); }
  }, [state.selectedCampaignId, refreshCampaign]);

  const addINpcToEncounter = React.useCallback(async (inpcId: string) => {
    if (!state.selectedEncounterId) return;
    try {
      await api(`/api/encounters/${state.selectedEncounterId}/combatants/addInpc`, jsonInit("POST", { inpcId }));
      await refreshEncounter(state.selectedEncounterId);
    } catch (e) { apiErr(e); }
  }, [state.selectedEncounterId, refreshEncounter]);

  const deleteCampaign = React.useCallback(async (campaignId: string) => {
    if (!campaignId) return;
    if (!(await confirm({
      title: "Delete campaign",
      message: "Delete this campaign? This will delete ALL its adventures, encounters, players, notes, etc.",
      intent: "danger"
    }))) return;
    try {
      await api(`/api/campaigns/${campaignId}`, { method: "DELETE" });
      await refreshAll();
    } catch (e) { apiErr(e); }
  }, [confirm, refreshAll]);

  const deleteAdventure = React.useCallback(async (adventureId: string) => {
    if (!(await confirm({
      title: "Delete adventure",
      message: "Delete this adventure? This will also delete its encounters and notes.",
      intent: "danger"
    }))) return;
    try {
      await api(`/api/adventures/${adventureId}`, { method: "DELETE" });
      await refreshCampaign(state.selectedCampaignId);
      await refreshAdventure(state.selectedAdventureId);
    } catch (e) { apiErr(e); }
  }, [state.selectedCampaignId, state.selectedAdventureId, confirm, refreshCampaign, refreshAdventure]);

  const duplicateEncounter = React.useCallback(async (encounterId: string) => {
    try {
      await api(`/api/encounters/${encounterId}/duplicate`, { method: "POST" });
      await refreshAdventure(state.selectedAdventureId);
    } catch (e) { apiErr(e); }
  }, [state.selectedAdventureId, refreshAdventure]);

  const deleteEncounter = React.useCallback(async (encounterId: string) => {
    if (!(await confirm({ title: "Delete encounter", message: "Delete this encounter?", intent: "danger" }))) return;
    try {
      await api(`/api/encounters/${encounterId}`, { method: "DELETE" });
      await refreshAdventure(state.selectedAdventureId);
      await refreshCampaign(state.selectedCampaignId);
    } catch (e) { apiErr(e); }
  }, [state.selectedAdventureId, state.selectedCampaignId, confirm, refreshAdventure, refreshCampaign]);

  const deleteCampaignNote = React.useCallback(async (noteId: string) => {
    if (!(await confirm({ title: "Delete note", message: "Delete this note?", intent: "danger" }))) return;
    try {
      await api(`/api/notes/${noteId}`, { method: "DELETE" });
      await refreshCampaign(state.selectedCampaignId);
    } catch (e) { apiErr(e); }
  }, [state.selectedCampaignId, confirm, refreshCampaign]);

  const deleteAdventureNote = React.useCallback(async (noteId: string) => {
    if (!(await confirm({ title: "Delete note", message: "Delete this note?", intent: "danger" }))) return;
    try {
      await api(`/api/notes/${noteId}`, { method: "DELETE" });
      await refreshAdventure(state.selectedAdventureId);
    } catch (e) { apiErr(e); }
  }, [state.selectedAdventureId, confirm, refreshAdventure]);

  return {
    addAllPlayers,
    addPlayerToEncounter,
    fullRestPlayers,
    reorderAdventures,
    reorderEncounters,
    reorderCampaignNotes,
    reorderAdventureNotes,
    addMonster,
    removeCombatant,
    addINpcFromMonster,
    deletePlayer,
    deleteINpc,
    exportAdventure,
    handleImportAdventureFile,
    addINpcToEncounter,
    deleteCampaign,
    deleteAdventure,
    duplicateEncounter,
    deleteEncounter,
    deleteCampaignNote,
    deleteAdventureNote,
  };
}
