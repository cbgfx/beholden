import * as React from "react";
import { api } from "@/services/api";
import { useStore } from "@/store";
import type { Combatant, INpc } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

export function useMonsterDetailsCache(
  combatants: Combatant[],
  active: Combatant | null,
  target: Combatant | null,
  inpcsById?: Record<string, INpc | undefined>
) {
  const { state, dispatch } = useStore();
  const monsterCache = state.monsterDetails;

  const setMonsterCache = React.useCallback(
    (next: Record<string, MonsterDetail>) => {
      dispatch({ type: "mergeMonsterDetails", patch: next });
    },
    [dispatch]
  );

  const resolveMonsterId = React.useCallback(
    (c: Combatant | null): string | null => {
      if (!c) return null;
      if (c.baseType === "monster" && typeof c.baseId === "string") return c.baseId;
      if (c.baseType === "inpc") {
        const mid = inpcsById?.[String(c.baseId)]?.monsterId;
        return typeof mid === "string" && mid.trim() ? mid : null;
      }
      return null;
    },
    [inpcsById]
  );

  const activeMonsterId = resolveMonsterId(active);
  const targetMonsterId = resolveMonsterId(target);

  const activeMonster = activeMonsterId ? monsterCache[activeMonsterId] ?? null : null;
  const targetMonster = targetMonsterId ? monsterCache[targetMonsterId] ?? null : null;

  const monsterCrById = React.useMemo(() => {
    const m: Record<string, number | null | undefined> = {};
    for (const [id, d] of Object.entries(monsterCache)) m[id] = d?.cr ?? null;
    return m;
  }, [monsterCache]);

  const ensureMonster = React.useCallback(
    async (baseId: string) => {
      if (!baseId || monsterCache[baseId]) return;
      try {
        const d = await api<MonsterDetail>(`/api/compendium/monsters/${baseId}`);
        dispatch({ type: "mergeMonsterDetails", patch: { [baseId]: d } });
      } catch {
        // ignore — panel will show without compendium data
      }
    },
    [monsterCache, dispatch]
  );

  // Ensure active combatant's monster data.
  React.useEffect(() => {
    const mid = resolveMonsterId(active);
    if (mid) void ensureMonster(mid);
  }, [active?.id, active?.baseType, active?.baseId, ensureMonster, resolveMonsterId]);

  // Ensure target combatant's monster data.
  React.useEffect(() => {
    const mid = resolveMonsterId(target);
    if (mid) void ensureMonster(mid);
  }, [target?.id, target?.baseType, target?.baseId, ensureMonster, resolveMonsterId]);

  // Preload CR data for all roster monsters in parallel so initiative order
  // rows don't flash with missing XP/CR. Was a serial await-in-loop before.
  React.useEffect(() => {
    let alive = true;

    const missing = Array.from(
      new Set(
        combatants
          .map((c) => resolveMonsterId(c))
          .filter((id): id is string => typeof id === "string" && Boolean(id))
      )
    ).filter((id) => !monsterCache[id]);

    if (!missing.length) return;

    Promise.allSettled(
      missing.map((id) =>
        api<MonsterDetail>(`/api/compendium/monsters/${id}`).then((d) => ({ id, d }))
      )
    ).then((results) => {
      if (!alive) return;
      const patch: Record<string, MonsterDetail> = {};
      for (const r of results) {
        if (r.status === "fulfilled") patch[r.value.id] = r.value.d;
      }
      if (Object.keys(patch).length) {
        dispatch({ type: "mergeMonsterDetails", patch });
      }
    });

    return () => { alive = false; };
  }, [combatants, monsterCache, dispatch, resolveMonsterId]);

  return {
    monsterCache,
    setMonsterCache,
    monsterCrById,
    activeMonster,
    targetMonster,
    activeMonsterKey: activeMonsterId,
    targetMonsterKey: targetMonsterId,
  };
}
