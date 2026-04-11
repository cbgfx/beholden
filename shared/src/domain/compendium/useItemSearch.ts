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

const ITEM_LIST_CACHE_TTL_MS = 30_000;
let cachedItemRows: ItemSearchRow[] | null = null;
let cachedItemRowsAtMs = 0;
let inflightItemRows: Promise<ItemSearchRow[]> | null = null;

function readItemRowsFromCache(): ItemSearchRow[] | null {
  if (!cachedItemRows) return null;
  if (Date.now() - cachedItemRowsAtMs > ITEM_LIST_CACHE_TTL_MS) return null;
  return cachedItemRows;
}

function loadItemRows(api: ApiFn, forceRefresh: boolean): Promise<ItemSearchRow[]> {
  if (!forceRefresh) {
    const cached = readItemRowsFromCache();
    if (cached) return Promise.resolve(cached);
  }
  if (inflightItemRows) return inflightItemRows;
  inflightItemRows = api<ItemSearchRow[]>("/api/compendium/items?compact=1")
    .then((rows) => {
      const safeRows = Array.isArray(rows) ? rows : [];
      cachedItemRows = safeRows;
      cachedItemRowsAtMs = Date.now();
      return safeRows;
    })
    .finally(() => {
      inflightItemRows = null;
    });
  return inflightItemRows;
}

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
    const forceRefresh = refreshKey > 0;
    const cached = !forceRefresh ? readItemRowsFromCache() : null;

    if (cached) {
      setAllRows(cached);
      setBusy(false);
      if (includeError) setError(null);
      return () => {
        cancelled = true;
      };
    }

    setBusy(true);
    if (includeError) setError(null);
    loadItemRows(api, forceRefresh)
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

  const clearFilters = React.useCallback(() => {
    setRarityFilter("all");
    setTypeFilter("all");
    setFilterAttunement(false);
    setFilterMagic(false);
  }, []);

  const refresh = React.useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

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
    refresh,
  };
}
