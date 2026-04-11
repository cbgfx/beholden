import * as React from "react";
import { api } from "@/services/api";
import type { MonsterDetail, SpellDetail } from "@/views/CombatView/types";
import { parseMonsterSpells, sortSpellNames } from "@/views/CombatView/utils/spells";

type SpellSummaryLite = { id: string; name: string; level: number | null };
type SpellLookupRow = {
  query: string;
  match: SpellSummaryLite | null;
};

export function useSpellModal(activeMonster: MonsterDetail | null, targetMonster: MonsterDetail | null) {
  const [spellLevelCache, setSpellLevelCache] = React.useState<Record<string, number | null>>({});
  const [spellSummaryCache, setSpellSummaryCache] = React.useState<Record<string, SpellSummaryLite | null>>({});
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
      const cacheKey = q.toLowerCase();
      let best = spellSummaryCache[cacheKey] ?? null;
      if (!best) {
        const payload = await api<{ rows: SpellLookupRow[] }>("/api/spells/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: [q] }),
        });
        best = payload.rows?.[0]?.match ?? null;
        setSpellSummaryCache((prev) => ({ ...prev, [cacheKey]: best ?? null }));
      }
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
  }, [spellSummaryCache]);

  // Load spell levels (light cache) so we can sort by spell level.
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const names = Array.from(new Set([...targetSpellNames, ...activeSpellNames]));
      const unresolved = names.filter((n) => {
        const key = n.trim().toLowerCase();
        return key && spellLevelCache[key] === undefined;
      });
      if (unresolved.length === 0) return;
      try {
        const payload = await api<{ rows: SpellLookupRow[] }>("/api/spells/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ names: unresolved }),
        });
        if (!alive) return;
        const nextSummary: Record<string, SpellSummaryLite | null> = {};
        const nextLevels: Record<string, number | null> = {};
        for (const row of payload.rows ?? []) {
          const key = row.query.trim().toLowerCase();
          if (!key) continue;
          const best = row.match ?? null;
          const lvl = best ? Number(best.level) : null;
          nextSummary[key] = best;
          nextLevels[key] = Number.isFinite(lvl) ? lvl : null;
        }
        setSpellSummaryCache((prev) => ({ ...prev, ...nextSummary }));
        setSpellLevelCache((prev) => ({ ...prev, ...nextLevels }));
      } catch {
        if (!alive) return;
        const nextSummary: Record<string, null> = {};
        const nextLevels: Record<string, null> = {};
        for (const n of unresolved) {
          const key = n.trim().toLowerCase();
          if (!key) continue;
          nextSummary[key] = null;
          nextLevels[key] = null;
        }
        setSpellSummaryCache((prev) => ({ ...prev, ...nextSummary }));
        setSpellLevelCache((prev) => ({ ...prev, ...nextLevels }));
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
