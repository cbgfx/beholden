import React from "react";
import {
  buildItemRarityOptions,
  buildItemTypeOptions,
  filterItemRows,
  type ItemSearchRow,
} from "./itemSearch";

type ApiFn = <T>(path: string) => Promise<T>;

export type UseCompendiumItemSearchOptions = {
  nameSearchValue?: (name: string) => string;
  includeError?: boolean;
};

export function useCompendiumItemSearch(
  api: ApiFn,
  options: UseCompendiumItemSearchOptions = {},
) {
  const { nameSearchValue, includeError = false } = options;
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
    if (includeError) setError(null);
    api<ItemSearchRow[]>("/api/compendium/items")
      .then((data) => {
        if (!cancelled) setAllRows(data ?? []);
      })
      .catch((err) => {
        if (cancelled) return;
        setAllRows([]);
        if (includeError) {
          setError(err instanceof Error ? err.message : "Failed to load items");
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, includeError, refreshKey]);

  const rarityOptions = React.useMemo(() => buildItemRarityOptions(allRows), [allRows]);
  const typeOptions = React.useMemo(() => buildItemTypeOptions(allRows), [allRows]);

  const rows = React.useMemo(
    () =>
      filterItemRows(allRows, {
        q,
        rarityFilter,
        typeFilter,
        filterAttunement,
        filterMagic,
        nameSearchValue,
      }),
    [allRows, q, rarityFilter, typeFilter, filterAttunement, filterMagic, nameSearchValue],
  );

  const hasActiveFilters =
    rarityFilter !== "all" || typeFilter !== "all" || filterAttunement || filterMagic;

  function clearFilters() {
    setRarityFilter("all");
    setTypeFilter("all");
    setFilterAttunement(false);
    setFilterMagic(false);
  }

  return {
    q,
    setQ,
    rarityFilter,
    setRarityFilter,
    rarityOptions,
    typeFilter,
    setTypeFilter,
    typeOptions,
    filterAttunement,
    setFilterAttunement,
    filterMagic,
    setFilterMagic,
    hasActiveFilters,
    clearFilters,
    rows,
    busy,
    error,
    totalCount: allRows.length,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
