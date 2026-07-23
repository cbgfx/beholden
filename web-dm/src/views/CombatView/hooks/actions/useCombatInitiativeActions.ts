import * as React from "react";
import { api } from "@/services/api";
import type { EncounterActor } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import { dexModFromMonster } from "@/views/CombatView/utils/combat";
import { putEncounterCombatant } from "@/services/encounterApi";

type Args = {
  encounterId: string | undefined;
  orderedCombatants: EncounterActor[];
  inpcsById: Record<string, { monsterId?: string } | undefined>;
  monsterCache: Record<string, MonsterDetail>;
  setMonsterCache: (next: Record<string, MonsterDetail>) => void;
  refresh: () => Promise<void>;
};

export function useCombatInitiativeActions({
  encounterId,
  orderedCombatants,
  inpcsById,
  monsterCache,
  setMonsterCache,
  refresh,
}: Args) {
  const rollInitiativeForMonsters = React.useCallback(async () => {
    if (!encounterId) return;
    // Roll initiative for monsters, iNPCs, and world actions that do not have a value yet.
    const targets = orderedCombatants.filter((c) => {
      if (c.baseType !== "monster" && c.baseType !== "inpc" && c.baseType !== "world") return false;
      if (c.initiative == null) return true;
      return !Number.isFinite(Number(c.initiative));
    });
    const hasPlayerTargets = orderedCombatants.some(
      (c) => c.baseType === "player" && (c.initiative == null || !Number.isFinite(Number(c.initiative)))
    );
    if (!targets.length && !hasPlayerTargets) return;

    // Ensure monster details are available (for Dex mod).
    const localCache: Record<string, MonsterDetail> = { ...monsterCache };
    for (const c of targets) {
      if (c.baseType === "world") continue;
      const monsterId = c.baseType === "inpc" ? (inpcsById[c.baseId]?.monsterId ?? null) : c.baseId;
      if (!monsterId) continue;
      if (!localCache[monsterId]) {
        try {
          const d = await api<MonsterDetail>(`/api/compendium/monsters/${monsterId}`);
          localCache[monsterId] = d;
        } catch {
          // ignore
        }
      }
    }
    setMonsterCache(localCache);

    // Apply initiative to monsters/iNPCs.
    for (const c of targets) {
      if (c.baseType === "world") {
        const init = 1 + Math.floor(Math.random() * 20);
        try { await putEncounterCombatant(encounterId, c.id, { initiative: init }); } catch { /* manual fallback */ }
        continue;
      }
      const monsterId = c.baseType === "inpc" ? (inpcsById[c.baseId]?.monsterId ?? null) : c.baseId;
      const d = monsterId ? localCache[monsterId] ?? null : null;
      const mod = dexModFromMonster(d);
      const roll = 1 + Math.floor(Math.random() * 20);
      const init = roll + mod;
      try { await putEncounterCombatant(encounterId, c.id, { initiative: init }); } catch { /* skip, user can set manually */ }
    }

    // Prompt player combatants without initiative to roll on their sheet.
    if (hasPlayerTargets) {
      try {
        await api(`/api/encounters/${encounterId}/prompt-initiative`, { method: "POST" });
      } catch {
        // ignore — players can still enter initiative manually
      }
    }
    await refresh();
  }, [encounterId, orderedCombatants, monsterCache, setMonsterCache, inpcsById, refresh]);

  return { rollInitiativeForMonsters };
}
