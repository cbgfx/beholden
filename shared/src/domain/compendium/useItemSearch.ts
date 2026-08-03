import React from "react";
import {
  buildItemRarityOptions,
  buildItemTypeOptions,
  type ItemSearchRow,
} from "./itemSearch";
import {
  useAvailableCompendiumRulesets,
  usePaginatedCompendiumSearch,
  type CompendiumApi,
} from "./usePaginatedCompendiumSearch";

type ApiFn = CompendiumApi;

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
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [facets, setFacets] = React.useState<ItemFacetsResponse>({ rarity: [], type: [] });

  const [q, setQ] = React.useState("");
  const [rarityFilter, setRarityFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [filterAttunement, setFilterAttunement] = React.useState(false);
  const [filterMagic, setFilterMagic] = React.useState(false);
  const { availableRulesets, rulesetFilter, setRulesetFilter, showRulesetFilter } =
    useAvailableCompendiumRulesets(api, "items", enabled);

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

  // Ruleset filter is hidden entirely (and left unapplied) when a category has content in only
  // one ruleset -- nothing to choose between. Defaults to "all rulesets" even when both are
  // present: items in particular don't have a complete duplicate catalog per ruleset, so
  // silently picking one would hide items that only exist under the other.
  const requestPage = React.useCallback(async (offset: number, signal: AbortSignal) => {
    if (includeError) setError(null);
    const hasQuery = q.trim().length >= 2;
    const hasFacetFilters =
      rarityFilter !== "all" || typeFilter !== "all" || filterAttunement || filterMagic;
    const limit = hasQuery || hasFacetFilters ? SEARCH_LIMIT_FILTERED : SEARCH_LIMIT_BASE;
    const baseQuery = [
      `q=${encodeURIComponent(q)}`,
      `rarity=${encodeURIComponent(rarityFilter)}`,
      `type=${encodeURIComponent(typeFilter)}`,
      `attunement=${filterAttunement ? "1" : "0"}`,
      `magic=${filterMagic ? "1" : "0"}`,
      `fields=${encodeURIComponent("id,name,rarity,type,typeKey,attunement,magic")}`,
      ...(rulesetFilter ? [`ruleset=${encodeURIComponent(rulesetFilter)}`] : []),
    ].join("&");
    const data = await api<ItemSearchResponse>(
      `/api/compendium/items?compact=1&withTotal=1&limit=${limit}&offset=${offset}&${baseQuery}`,
      { signal },
    );
    const rows = Array.isArray(data?.rows) ? data.rows : [];
    return { rows, total: Number.isFinite(data?.total) ? Number(data.total) : rows.length };
  }, [api, filterAttunement, filterMagic, includeError, q, rarityFilter, rulesetFilter, typeFilter]);
  const onSearchError = React.useCallback((err: unknown) => {
    if (includeError) setError(err instanceof Error ? err.message : "Failed to load items");
  }, [includeError]);
  const { rows, totalCount, busy } = usePaginatedCompendiumSearch({
    enabled,
    refreshKey,
    requestPage,
    onError: onSearchError,
  });

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
    const lq = q.toLowerCase().trim();
    if (!lq) return rows;
    return rows.filter((row) =>
      nameSearchValue(row.name).toLowerCase().includes(lq) || row.name.toLowerCase().includes(lq),
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
    rulesetFilter,
    setRulesetFilter,
    availableRulesets,
    showRulesetFilter,
    hasActiveFilters,
    clearFilters,
    rows: visibleRows,
    busy,
    error,
    totalCount,
    refresh,
  };
}
