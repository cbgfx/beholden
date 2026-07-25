import React from "react";
import { api, jsonInit } from "@/services/api";
import {
  fetchAdventureTreasureList,
  fetchCampaignTreasureList,
  fetchEncounterTreasureList,
} from "@/services/collectionApi";
import type { TreasureEntry } from "@/domain/types/domain";
import { useStore } from "@/store";
import type { AddItemPayload } from "@/views/CampaignView/components/ItemPickerModal";

export type TreasureScope =
  | { level: "campaign" }
  | { level: "adventure"; adventureId: string }
  | { level: "encounter"; encounterId: string };

/**
 * Shared add/award/refresh logic for a campaign, adventure, or encounter treasure pool. Used by
 * the standalone TreasurePanel (encounter builder, adventure/campaign main page) as well as the
 * combat Rewards modal's "Monster carried Loot" section, so all of them stay in sync against the
 * same server flow.
 */
export function useTreasurePool(scope: TreasureScope) {
  const { state, dispatch } = useStore();

  // Callers commonly pass a fresh scope object literal on every render (e.g.
  // `useTreasurePool({ level: "encounter", encounterId })` inline). Depending on `scope` itself
  // in the callbacks below would make every one of them (and the refresh effect) re-run on every
  // render, not just when the scope actually changes. Derive a stable primitive key instead.
  const scopeKey = scope.level === "encounter" ? `encounter:${scope.encounterId}`
    : scope.level === "adventure" ? `adventure:${scope.adventureId}`
    : "campaign";

  const treasure = scope.level === "encounter" ? state.encounterTreasure
    : scope.level === "adventure" ? state.adventureTreasure
    : state.campaignTreasure;

  const refreshTreasure = React.useCallback(async () => {
    if (scope.level === "encounter") {
      const encounterTreasure = await fetchEncounterTreasureList(scope.encounterId) as TreasureEntry[];
      dispatch({ type: "setEncounterTreasure", treasure: encounterTreasure });
      return;
    }

    if (!state.selectedCampaignId) return;
    const campaignTreasure = await fetchCampaignTreasureList(state.selectedCampaignId) as TreasureEntry[];
    dispatch({ type: "setCampaignTreasure", treasure: campaignTreasure });

    if (scope.level === "adventure") {
      const adventureTreasure = await fetchAdventureTreasureList(scope.adventureId) as TreasureEntry[];
      dispatch({ type: "setAdventureTreasure", treasure: adventureTreasure });
    } else {
      dispatch({ type: "setAdventureTreasure", treasure: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scopeKey intentionally stands in for `scope` (see comment above)
  }, [dispatch, scopeKey, state.selectedCampaignId]);

  React.useEffect(() => {
    void refreshTreasure();
  }, [refreshTreasure]);

  const addItem = React.useCallback(async (payload: AddItemPayload) => {
    const endpoint = scope.level === "encounter"
      ? `/api/encounters/${scope.encounterId}/treasure`
      : scope.level === "adventure"
        ? `/api/adventures/${scope.adventureId}/treasure`
        : state.selectedCampaignId
          ? `/api/campaigns/${state.selectedCampaignId}/treasure`
          : null;
    if (!endpoint) return;

    if (payload.source === "compendium") {
      await api(endpoint, jsonInit("POST", { source: "compendium", itemId: payload.itemId, qty: payload.qty }));
    } else {
      await api(endpoint, jsonInit("POST", { source: "custom", custom: payload.custom, qty: payload.qty }));
    }

    await refreshTreasure();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- scopeKey intentionally stands in for `scope`
  }, [scopeKey, state.selectedCampaignId, refreshTreasure]);

  const remove = React.useCallback(async (id: string) => {
    await api(`/api/treasure/${id}`, { method: "DELETE" });
    await refreshTreasure();
  }, [refreshTreasure]);

  const updateQty = React.useCallback(async (id: string, qty: number) => {
    await api(`/api/treasure/${id}/qty`, jsonInit("PATCH", { qty }));
    await refreshTreasure();
  }, [refreshTreasure]);

  const [awardTreasure, setAwardTreasure] = React.useState<TreasureEntry | null>(null);
  const [awardBusy, setAwardBusy] = React.useState(false);
  const [awardError, setAwardError] = React.useState<string | null>(null);

  const award = React.useCallback(async (playerId: string, quantity: number) => {
    if (!awardTreasure) return;
    setAwardBusy(true);
    setAwardError(null);
    try {
      await api(`/api/treasure/${awardTreasure.id}/award`, jsonInit("POST", { playerId, quantity }));
      setAwardTreasure(null);
      await refreshTreasure();
    } catch (error) {
      setAwardError(error instanceof Error ? error.message : "Could not award treasure.");
    } finally {
      setAwardBusy(false);
    }
  }, [awardTreasure, refreshTreasure]);

  return {
    treasure,
    refreshTreasure,
    addItem,
    remove,
    updateQty,
    award,
    awardTreasure,
    setAwardTreasure,
    awardBusy,
    awardError,
    setAwardError,
  };
}
