import * as React from "react";
import { api } from "@/services/api";
import type { Combatant } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import { dexModFromMonster } from "@/views/CombatView/utils/combat";

type Args = {
  encounterId: string | undefined;
  orderedCombatants: Combatant[];
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
  refresh
}: Args) {
  const rollInitiativeForMonsters = React.useCallback(async () => {
    if (!encounterId) return;
    // Roll initiative for monsters + iNPCs; treat 0 as missing.
    const targets = orderedCombatants.filter((c) => {
      if (c.baseType !== "monster" && c.baseType !== "inpc") return false;
      const init = Number(c.initiative);
      return !Number.isFinite(init) || init === 0;
    });
    if (!targets.length) return;

    // Ensure monster details are available (for Dex mod).
    const localCache: Record<string, MonsterDetail> = { ...monsterCache };
    for (const c of targets) {
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

    // Apply initiative.
    for (const c of targets) {
      const monsterId = c.baseType === "inpc" ? (inpcsById[c.baseId]?.monsterId ?? null) : c.baseId;
      const d = monsterId ? localCache[monsterId] ?? null : null;
      const mod = dexModFromMonster(d);
      const roll = 1 + Math.floor(Math.random() * 20);
      const init = roll + mod;
      await api(`/api/encounters/${encounterId}/combatants/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initiative: init })
      });
    }
    await refresh();
  }, [encounterId, orderedCombatants, monsterCache, setMonsterCache, refresh, inpcsById]);

  return { rollInitiativeForMonsters };
}
