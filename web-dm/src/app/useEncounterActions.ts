import React from "react";
import type { AddMonsterOptions } from "@/domain/types/domain";
import { deleteEncounterCombatant, postEncounterCombatants } from "@/services/encounterApi";

function apiErr(e: unknown) {
  alert(e instanceof Error ? e.message : "Something went wrong. Please try again.");
}

export function useEncounterActions(
  encounterId: string | undefined,
  refreshEncounter?: () => Promise<void>
) {
  const addAllPlayers = React.useCallback(async () => {
    if (!encounterId) return;
    try {
      await postEncounterCombatants(encounterId, "addPlayers");
      await refreshEncounter?.();
    } catch (e) { apiErr(e); }
  }, [encounterId, refreshEncounter]);

  const addPlayerToEncounter = React.useCallback(async (playerId: string) => {
    if (!encounterId) return;
    try {
      await postEncounterCombatants(encounterId, "addPlayer", { playerId });
      await refreshEncounter?.();
    } catch (e) { apiErr(e); }
  }, [encounterId, refreshEncounter]);

  const addMonster = React.useCallback(async (monsterId: string, qty: number, opts?: AddMonsterOptions) => {
    if (!encounterId) return;
    try {
      await postEncounterCombatants(encounterId, "addMonster", {
        monsterId,
        qty,
        friendly: Boolean(opts?.friendly ?? false),
        labelBase: opts?.labelBase?.trim() || undefined,
        ac: opts?.ac,
        acDetails: opts?.acDetails ?? undefined,
        hpMax: opts?.hpMax,
        hpDetails: opts?.hpDetails ?? undefined,
        attackOverrides: opts?.attackOverrides ?? null,
      });
      await refreshEncounter?.();
    } catch (e) { apiErr(e); }
  }, [encounterId, refreshEncounter]);

  const addWorldAction = React.useCallback(async (name: string, description?: string) => {
    if (!encounterId) return;
    try {
      await postEncounterCombatants(encounterId, "addWorldAction", { name, description });
      await refreshEncounter?.();
    } catch (e) { apiErr(e); }
  }, [encounterId, refreshEncounter]);

  const removeCombatant = React.useCallback(async (combatantId: string) => {
    if (!encounterId) return;
    try {
      await deleteEncounterCombatant(encounterId, combatantId);
      await refreshEncounter?.();
    } catch (e) { apiErr(e); }
  }, [encounterId, refreshEncounter]);

  const addINpcToEncounter = React.useCallback(async (inpcId: string) => {
    if (!encounterId) return;
    try {
      await postEncounterCombatants(encounterId, "addInpc", { inpcId });
      await refreshEncounter?.();
    } catch (e) { apiErr(e); }
  }, [encounterId, refreshEncounter]);

  return { addAllPlayers, addPlayerToEncounter, addMonster, addWorldAction, removeCombatant, addINpcToEncounter };
}
