import React from "react";
import type { AddMonsterOptions } from "@/domain/types/domain";
import { deleteEncounterCombatant, postEncounterCombatants } from "@/services/encounterApi";

function apiErr(e: unknown) {
  alert(e instanceof Error ? e.message : "Something went wrong. Please try again.");
}

export function useEncounterActions(
  encounterId: string | undefined
) {
  const addAllPlayers = React.useCallback(async () => {
    if (!encounterId) return;
    try {
      await postEncounterCombatants(encounterId, "addPlayers");
    } catch (e) { apiErr(e); }
  }, [encounterId]);

  const addPlayerToEncounter = React.useCallback(async (playerId: string) => {
    if (!encounterId) return;
    try {
      await postEncounterCombatants(encounterId, "addPlayer", { playerId });
    } catch (e) { apiErr(e); }
  }, [encounterId]);

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
    } catch (e) { apiErr(e); }
  }, [encounterId]);

  const removeCombatant = React.useCallback(async (combatantId: string) => {
    if (!encounterId) return;
    try {
      await deleteEncounterCombatant(encounterId, combatantId);
    } catch (e) { apiErr(e); }
  }, [encounterId]);

  const addINpcToEncounter = React.useCallback(async (inpcId: string) => {
    if (!encounterId) return;
    try {
      await postEncounterCombatants(encounterId, "addInpc", { inpcId });
    } catch (e) { apiErr(e); }
  }, [encounterId]);

  return { addAllPlayers, addPlayerToEncounter, addMonster, removeCombatant, addINpcToEncounter };
}
