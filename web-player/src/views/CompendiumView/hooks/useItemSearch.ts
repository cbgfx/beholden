import React from "react";
import { api } from "@/services/api";

export type ItemSearchRow = {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  typeKey: string | null;
  attunement: boolean;
  magic: boolean;
};

const RARITY_ORDER = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"];

export function useItemSearch() {
  const [allRows, setAllRows] = React.useState<ItemSearchRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [q, setQ] = React.useState("");
  const [rarityFilter, setRarityFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [filterAttunement, setFilterAttunement] = React.useState(false);
  const [filterMagic, setFilterMagic] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    api<ItemSearchRow[]>("/api/compendium/items")
      .then((data) => { if (!cancelled) setAllRows(data ?? []); })
      .catch((err) => {
        if (!cancelled) {
          setAllRows([]);
          setError(err instanceof Error ? err.message : "Failed to load items");
        }
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const rarityOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) if (r.rarity) set.add(r.rarity);
    const ordered = RARITY_ORDER.filter((r) => set.has(r));
    const extra = Array.from(set).filter((r) => !RARITY_ORDER.includes(r)).sort();
    return ["all", ...ordered, ...extra];
  }, [allRows]);

  const typeOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) if (r.type) set.add(r.type);
    return ["all", ...Array.from(set).sort()];
  }, [allRows]);

  const rows = React.useMemo(() => {
    const qLow = q.toLowerCase().trim();
    return allRows.filter((r) => {
      if (qLow && !r.name.toLowerCase().includes(qLow)) return false;
      if (rarityFilter !== "all" && r.rarity !== rarityFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (filterAttunement && !r.attunement) return false;
      if (filterMagic && !r.magic) return false;
      return true;
    });
  }, [allRows, q, rarityFilter, typeFilter, filterAttunement, filterMagic]);

  const hasActiveFilters = rarityFilter !== "all" || typeFilter !== "all" || filterAttunement || filterMagic;

  function clearFilters() {
    setRarityFilter("all"); setTypeFilter("all");
    setFilterAttunement(false); setFilterMagic(false);
  }

  const refresh = React.useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    q, setQ,
    rarityFilter, setRarityFilter, rarityOptions,
    typeFilter, setTypeFilter, typeOptions,
    filterAttunement, setFilterAttunement,
    filterMagic, setFilterMagic,
    hasActiveFilters, clearFilters,
    rows, busy, error, totalCount: allRows.length,
    refresh,
  };
}
