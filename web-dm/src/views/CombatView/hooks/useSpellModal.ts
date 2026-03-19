import * as React from "react";
import { api } from "@/services/api";
import type { MonsterDetail, SpellDetail, SpellSummary } from "@/views/CombatView/types";
import { bestSpellMatch, parseMonsterSpells, sortSpellNames } from "@/views/CombatView/utils/spells";

export function useSpellModal(activeMonster: MonsterDetail | null, targetMonster: MonsterDetail | null) {
  const [spellLevelCache, setSpellLevelCache] = React.useState<Record<string, number | null>>({});
  const [spellDetail, setSpellDetail] = React.useState<SpellDetail | null>(null);
  const [spellError, setSpellError] = React.useState<string | null>(null);
  const [spellLoading, setSpellLoading] = React.useState(false);

  const activeSpellNames = React.useMemo(() => parseMonsterSpells(activeMonster), [activeMonster?.id]);
  const targetSpellNames = React.useMemo(() => parseMonsterSpells(targetMonster), [targetMonster?.id]);

  const openSpellByName = React.useCallback(async (name: string) => {
    setSpellError(null);
    setSpellDetail(null);
    const q = name.trim();
    if (!q) return;
    setSpellLoading(true);
    try {
      const rows = await api<SpellSummary[]>(`/api/spells/search?q=${encodeURIComponent(q)}&limit=10`);
      const best = bestSpellMatch(rows, q);
      if (!best) {
        setSpellError("Spell not found in compendium.");
        return;
      }
      const full = await api<SpellDetail>(`/api/spells/${best.id}`);
      setSpellDetail(full);
    } catch {
      setSpellError("Could not load spell.");
    } finally {
      setSpellLoading(false);
    }
  }, []);

  // Load spell levels (light cache) so we can sort by spell level.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const names = Array.from(new Set([...targetSpellNames, ...activeSpellNames]));
      for (const n of names) {
        const key = n.trim().toLowerCase();
        if (!key) continue;
        if (spellLevelCache[key] !== undefined) continue;
        try {
          const rows = await api<SpellSummary[]>(`/api/spells/search?q=${encodeURIComponent(n)}&limit=5`);
          const best = bestSpellMatch(rows, n);
          const lvl = best ? Number(best.level) : null;
          if (!alive) return;
          setSpellLevelCache((prev) => ({ ...prev, [key]: Number.isFinite(lvl) ? lvl : null }));
        } catch {
          if (!alive) return;
          setSpellLevelCache((prev) => ({ ...prev, [key]: null }));
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [targetSpellNames.join("|"), activeSpellNames.join("|"), spellLevelCache]);

  const sortedActiveSpellNames = React.useMemo(
    () => sortSpellNames(activeSpellNames, spellLevelCache),
    [activeSpellNames, spellLevelCache]
  );
  const sortedTargetSpellNames = React.useMemo(
    () => sortSpellNames(targetSpellNames, spellLevelCache),
    [targetSpellNames, spellLevelCache]
  );

  const closeSpell = React.useCallback(() => {
    setSpellLoading(false);
    setSpellError(null);
    setSpellDetail(null);
  }, []);

  return {
    spellLevelCache,
    spellDetail,
    spellError,
    spellLoading,
    openSpellByName,
    closeSpell,
    sortedActiveSpellNames,
    sortedTargetSpellNames
  };
}
