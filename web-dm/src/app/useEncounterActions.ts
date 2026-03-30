import React from "react";
import { api, jsonInit } from "@/services/api";
import type { AddMonsterOptions } from "@/domain/types/domain";

function apiErr(e: unknown) {
  alert(e instanceof Error ? e.message : "Something went wrong. Please try again.");
}

export function useEncounterActions(
  encounterId: string | undefined,
  refresh: () => Promise<void>
) {
  const addAllPlayers = React.useCallback(async () => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}/combatants/addPlayers`, { method: "POST" });
      await refresh();
    } catch (e) { apiErr(e); }
  }, [encounterId, refresh]);

  const addPlayerToEncounter = React.useCallback(async (playerId: string) => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}/combatants/addPlayer`, jsonInit("POST", { playerId }));
      await refresh();
    } catch (e) { apiErr(e); }
  }, [encounterId, refresh]);

  const addMonster = React.useCallback(async (monsterId: string, qty: number, opts?: AddMonsterOptions) => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}/combatants/addMonster`, jsonInit("POST", {
        monsterId,
        qty,
        friendly: Boolean(opts?.friendly ?? false),
        labelBase: opts?.labelBase?.trim() || undefined,
        ac: opts?.ac,
        acDetails: opts?.acDetails ?? undefined,
        hpMax: opts?.hpMax,
        hpDetails: opts?.hpDetails ?? undefined,
        attackOverrides: opts?.attackOverrides ?? null,
      }));
      await refresh();
    } catch (e) { apiErr(e); }
  }, [encounterId, refresh]);

  const removeCombatant = React.useCallback(async (combatantId: string) => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}/combatants/${combatantId}`, { method: "DELETE" });
      await refresh();
    } catch (e) { apiErr(e); }
  }, [encounterId, refresh]);

  const addINpcToEncounter = React.useCallback(async (inpcId: string) => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}/combatants/addInpc`, jsonInit("POST", { inpcId }));
      await refresh();
    } catch (e) { apiErr(e); }
  }, [encounterId, refresh]);

  return { addAllPlayers, addPlayerToEncounter, addMonster, removeCombatant, addINpcToEncounter };
}
