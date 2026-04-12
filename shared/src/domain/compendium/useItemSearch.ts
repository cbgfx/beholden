import React from "react";
import {
  buildItemRarityOptions,
  buildItemTypeOptions,
  type ItemSearchRow,
} from "./itemSearch";

type ApiFn = <T>(path: string, init?: RequestInit) => Promise<T>;

export type UseCompendiumItemSearchOptions = {
  nameSearchValue?: (name: string) => string;
  includeError?: boolean;
  enabled?: boolean;
};

type ItemFacetOption = { value: string; count: number };
type ItemFacetsResponse = { rarity: ItemFacetOption[]; type: ItemFacetOption[] };
type ItemSearchResponse = { rows: ItemSearchRow[]; total: number };

const SEARCH_LIMIT_BASE = 120;
const SEARCH_LIMIT_FILTERED = 220;

export function useCompendiumItemSearch(
  api: ApiFn,
  options: UseCompendiumItemSearchOptions = {},
) {
  const { nameSearchValue, includeError = false } = options;
  const enabled = options.enabled ?? true;
  const [rows, setRows] = React.useState<ItemSearchRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [totalCount, setTotalCount] = React.useState(0);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [facets, setFacets] = React.useState<ItemFacetsResponse>({ rarity: [], type: [] });

  const [q, setQ] = React.useState("");
  const [rarityFilter, setRarityFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [filterAttunement, setFilterAttunement] = React.useState(false);
  const [filterMagic, setFilterMagic] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let alive = true;
    api<ItemFacetsResponse>("/api/compendium/items/facets", { signal: controller.signal })
      .then((data) => {
        if (!alive) return;
        setFacets({
          rarity: Array.isArray(data?.rarity) ? data.rarity : [],
          type: Array.isArray(data?.type) ? data.type : [],
        });
      })
      .catch(() => {
        if (!alive) return;
        setFacets({ rarity: [], type: [] });
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [api, refreshKey, enabled]);

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      if (includeError) setError(null);
      try {
        const hasQuery = q.trim().length >= 2;
        const hasFacetFilters =
          rarityFilter !== "all" || typeFilter !== "all" || filterAttunement || filterMagic;
        const limit = hasQuery || hasFacetFilters ? SEARCH_LIMIT_FILTERED : SEARCH_LIMIT_BASE;
        const queryParts = [
          `/api/compendium/items?compact=1&withTotal=1&limit=${limit}&offset=0`,
          `q=${encodeURIComponent(q)}`,
          `rarity=${encodeURIComponent(rarityFilter)}`,
          `type=${encodeURIComponent(typeFilter)}`,
          `attunement=${filterAttunement ? "1" : "0"}`,
          `magic=${filterMagic ? "1" : "0"}`,
        ];
        const data = await api<ItemSearchResponse>(queryParts.join("&"), { signal: controller.signal });
        if (controller.signal.aborted) return;
        const nextRows = Array.isArray(data?.rows) ? data.rows : [];
        setRows(nextRows);
        setTotalCount(Number.isFinite(data?.total as number) ? Number(data.total) : nextRows.length);
      } catch (err) {
        if (controller.signal.aborted) return;
        setRows([]);
        setTotalCount(0);
        if (includeError) {
          setError(err instanceof Error ? err.message : "Failed to load items");
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    api,
    enabled,
    q,
    rarityFilter,
    typeFilter,
    filterAttunement,
    filterMagic,
    includeError,
    refreshKey,
  ]);

  const rarityOptions = React.useMemo(() => {
    const rowsFromFacets = facets.rarity.map((entry) => ({
      id: "",
      name: "",
      rarity: entry.value,
      type: null,
      typeKey: null,
      attunement: false,
      magic: false,
    } satisfies ItemSearchRow));
    const fallback = buildItemRarityOptions(rows);
    const fromFacets = buildItemRarityOptions(rowsFromFacets);
    return fromFacets.length > 1 ? fromFacets : fallback;
  }, [facets.rarity, rows]);

  const typeOptions = React.useMemo(() => {
    const rowsFromFacets = facets.type.map((entry) => ({
      id: "",
      name: "",
      rarity: null,
      type: entry.value,
      typeKey: null,
      attunement: false,
      magic: false,
    } satisfies ItemSearchRow));
    const fallback = buildItemTypeOptions(rows);
    const fromFacets = buildItemTypeOptions(rowsFromFacets);
    return fromFacets.length > 1 ? fromFacets : fallback;
  }, [facets.type, rows]);
  const visibleRows = React.useMemo(() => {
    if (!nameSearchValue) return rows;
    return rows.filter((row) =>
      nameSearchValue(row.name).toLowerCase().includes(q.toLowerCase().trim()),
    );
  }, [rows, q, nameSearchValue]);

  const hasActiveFilters =
    rarityFilter !== "all" || typeFilter !== "all" || filterAttunement || filterMagic;

  const clearFilters = React.useCallback(() => {
    setRarityFilter("all");
    setTypeFilter("all");
    setFilterAttunement(false);
    setFilterMagic(false);
  }, []);

  const refresh = React.useCallback(() => {
    if (!enabled) return;
    setRefreshKey((k) => k + 1);
  }, [enabled]);

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
    rows: visibleRows,
    busy,
    error,
    totalCount,
    refresh,
  };
}
