import * as React from "react";
import { api } from "../../api/browserClient";
import { useAvailableRulesets } from "./useAvailableRulesets";
import { SIZE_LABELS, type CompendiumMonsterRow, type SortMode } from "./monsterPicker";
import { readPersistentFilters, writePersistentFilters } from "./persistentFilters";

/** Rows fetched per request. Also the granularity at which loaded windows are tracked. */
const PAGE_SIZE = 200;
const DEBOUNCE_MS = 220;

export type MonsterLetterIndex = { letters: string[]; firstIndex: Record<string, number> };

type LettersResponse = { letters?: { letter?: unknown; index?: unknown }[] };
type SearchResponse = { rows?: CompendiumMonsterRow[]; total?: number };

/**
 * Shared read-only browser state; editing stays in the DM panel.
 *
 * Unlike the spell and item browsers, this list can't simply append pages as you scroll: the A-Z
 * jump bar needs to send you to row 1,500 of 3,000 directly. So the list is virtualised over the
 * server's total and rows are fetched by window -- `rows` is a sparse array indexed by absolute
 * position, and a slot that is still undefined renders as a placeholder.
 */
export function useMonsterBrowser(options: {
  /**
   * Whether to fetch at all. The monster picker mounts this hook while its modal is closed, and a
   * closed modal has no business asking the server for anything.
   */
  enabled?: boolean;
  persistFilters?: boolean;
} = {}) {
  const enabled = options.enabled !== false;
  const persistFilters = options.persistFilters !== false;
  const [rows, setRows] = React.useState<(CompendiumMonsterRow | undefined)[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [totalRows, setTotalRows] = React.useState(0);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [envOptions, setEnvOptions] = React.useState<string[]>(["all"]);
  const [sizeOptions, setSizeOptions] = React.useState<string[]>(["all"]);
  const [typeOptions, setTypeOptions] = React.useState<string[]>(["all"]);
  const [letterIndex, setLetterIndex] = React.useState<MonsterLetterIndex>({ letters: [], firstIndex: {} });

  const refresh = React.useCallback(() => setRefreshKey((value) => value + 1), []);

  const initial = React.useMemo(() => persistFilters
    ? readPersistentFilters("compendium:monsters:filters", { compQ: "", sortMode: "az" as SortMode, envFilter: "all", sizeFilter: "all", typeFilter: "all", crMin: "", crMax: "" })
    : { compQ: "", sortMode: "az" as SortMode, envFilter: "all", sizeFilter: "all", typeFilter: "all", crMin: "", crMax: "" }, [persistFilters]);
  const [compQ, setCompQ] = React.useState(initial.compQ);
  const [sortMode, setSortMode] = React.useState<SortMode>(initial.sortMode);
  const [envFilter, setEnvFilter] = React.useState(initial.envFilter);
  const [sizeFilter, setSizeFilter] = React.useState(initial.sizeFilter);
  const [typeFilter, setTypeFilter] = React.useState(initial.typeFilter);
  const [crMin, setCrMin] = React.useState(initial.crMin);
  const [crMax, setCrMax] = React.useState(initial.crMax);
  const { rulesetFilter, setRulesetFilter, showRulesetFilter } = useAvailableRulesets(api, "monsters", enabled);

  React.useEffect(() => {
    if (enabled && persistFilters) writePersistentFilters("compendium:monsters:filters", { compQ, sortMode, envFilter, sizeFilter, typeFilter, crMin, crMax });
  }, [compQ, crMax, crMin, enabled, envFilter, persistFilters, sizeFilter, sortMode, typeFilter]);

  React.useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const query = rulesetFilter ? `?ruleset=${encodeURIComponent(rulesetFilter)}` : "";
    api<{ environments: string[]; sizes: string[]; types: string[] }>(`/api/compendium/monsters/facets${query}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (controller.signal.aborted) return;
        const nextEnv = Array.isArray(data?.environments) ? data.environments : [];
        const nextSizesRaw = Array.isArray(data?.sizes) ? data.sizes : [];
        const nextTypes = Array.isArray(data?.types) ? data.types : [];
        const sizeOrder = new Map<string, number>(SIZE_LABELS.map((size, index) => [size, index]));
        const nextSizes = [...nextSizesRaw].sort((a, b) => {
          const aOrder = sizeOrder.get(a);
          const bOrder = sizeOrder.get(b);
          if (aOrder != null && bOrder != null) return aOrder - bOrder;
          if (aOrder != null) return -1;
          if (bOrder != null) return 1;
          return a.localeCompare(b);
        });
        setEnvOptions(["all", ...nextEnv]);
        setSizeOptions(["all", ...nextSizes]);
        setTypeOptions(["all", ...nextTypes]);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setEnvOptions(["all"]);
        setSizeOptions(["all"]);
        setTypeOptions(["all"]);
      });
    return () => controller.abort();
  }, [enabled, refreshKey, rulesetFilter]);

  /** The filter half of the query, shared by the row, letter and count requests. */
  const filterParams = React.useMemo(() => {
    const params = new URLSearchParams({ q: compQ, sort: sortMode });
    if (envFilter !== "all") params.set("env", envFilter);
    if (sizeFilter !== "all") params.set("sizes", sizeFilter);
    if (typeFilter !== "all") params.set("types", typeFilter);
    if (crMin.trim()) params.set("crMin", crMin.trim());
    if (crMax.trim()) params.set("crMax", crMax.trim());
    if (rulesetFilter) params.set("ruleset", rulesetFilter);
    return params.toString();
  }, [compQ, crMax, crMin, envFilter, rulesetFilter, sizeFilter, sortMode, typeFilter]);

  // Which search the loaded windows belong to. A window that resolves after the filters changed
  // would otherwise drop rows from the old list into the new one's indices.
  const searchRef = React.useRef({
    generation: 0,
    requestedPages: new Set<number>(),
    controller: null as AbortController | null,
    filterParams: "",
  });

  const fetchPage = React.useCallback(async (generation: number, page: number) => {
    const search = searchRef.current;
    const controller = search.controller;
    if (!controller || search.requestedPages.has(page)) return;
    search.requestedPages.add(page);

    const offset = page * PAGE_SIZE;
    const query = `${search.filterParams}&limit=${PAGE_SIZE}&offset=${offset}&withTotal=1&fields=id,ruleset,name,cr,type,environment`;
    try {
      const result = await api<SearchResponse>(`/api/compendium/search?${query}`, { signal: controller.signal });
      if (controller.signal.aborted || searchRef.current.generation !== generation) return;

      const pageRows = Array.isArray(result?.rows) ? result.rows : [];
      const total = Number.isFinite(result?.total as number) ? Number(result.total) : pageRows.length;
      setTotalRows(total);
      setRows((current) => {
        const next = current.slice();
        next.length = total;
        for (let i = 0; i < pageRows.length; i += 1) next[offset + i] = pageRows[i];
        return next;
      });
      setLoadError(null);
    } catch (error) {
      if (controller.signal.aborted || searchRef.current.generation !== generation) return;
      // Let the window be retried: unlike an append-only list there is no "next page" to spin on,
      // and a user scrolling back over a failed window should get another attempt.
      search.requestedPages.delete(page);
      setLoadError(String((error as { message?: unknown })?.message ?? error));
    } finally {
      if (searchRef.current.generation === generation && page === 0) setLoading(false);
    }
  }, []);

  // A filter change starts a new search: drop every loaded window and fetch the first one.
  React.useEffect(() => {
    if (!enabled) return;
    const search = searchRef.current;
    const generation = search.generation + 1;

    const timer = window.setTimeout(() => {
      const controller = new AbortController();
      search.generation = generation;
      search.requestedPages = new Set();
      search.controller = controller;
      search.filterParams = filterParams;

      setLoading(true);
      setLoadError(null);
      setRows([]);
      setTotalRows(0);
      void fetchPage(generation, 0);

      api<LettersResponse>(`/api/compendium/monsters/letters?${filterParams}`, { signal: controller.signal })
        .then((data) => {
          if (controller.signal.aborted || searchRef.current.generation !== generation) return;
          const entries = Array.isArray(data?.letters) ? data.letters : [];
          const firstIndex: Record<string, number> = {};
          for (const entry of entries) {
            const letter = String(entry?.letter ?? "");
            const index = Number(entry?.index);
            if (letter && Number.isFinite(index)) firstIndex[letter] = index;
          }
          setLetterIndex({ letters: Object.keys(firstIndex).sort((a, b) => a.localeCompare(b)), firstIndex });
        })
        .catch(() => {
          if (controller.signal.aborted || searchRef.current.generation !== generation) return;
          // Without the index the bar can't jump anywhere, so hide it rather than show dead buttons.
          setLetterIndex({ letters: [], firstIndex: {} });
        });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      if (search.generation === generation) search.controller?.abort();
    };
  }, [enabled, fetchPage, filterParams, refreshKey]);

  /** Load whatever windows cover [start, end) -- called by the list as it scrolls or jumps. */
  const ensureRange = React.useCallback((start: number, end: number) => {
    const search = searchRef.current;
    if (!search.controller) return;
    const firstPage = Math.max(0, Math.floor(start / PAGE_SIZE));
    const lastPage = Math.max(0, Math.floor((Math.max(end, start + 1) - 1) / PAGE_SIZE));
    for (let page = firstPage; page <= lastPage; page += 1) {
      void fetchPage(search.generation, page);
    }
  }, [fetchPage]);

  return {
    rows,
    loading,
    loadError,
    totalRows,
    ensureRange,
    envOptions,
    sizeOptions,
    typeOptions,
    refresh,
    compQ,
    setCompQ,
    sortMode,
    setSortMode,
    envFilter,
    setEnvFilter,
    sizeFilter,
    setSizeFilter,
    typeFilter,
    setTypeFilter,
    crMin,
    setCrMin,
    crMax,
    setCrMax,
    rulesetFilter,
    setRulesetFilter,
    showRulesetFilter,
    lettersInList: letterIndex.letters,
    letterFirstIndex: letterIndex.firstIndex,
  };
}
