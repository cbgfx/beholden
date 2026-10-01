import React from "react";
import { expandSchool } from "./expandSchool";
import { normalizeSpellSearchRow, type SpellSearchRow } from "./normalizeSpellSearchRow";
import {
  useAvailableCompendiumRulesets,
  usePaginatedCompendiumSearch,
  type CompendiumApi,
} from "./usePaginatedCompendiumSearch";
import { readPersistentFilters, writePersistentFilters } from "./persistentFilters";

type ApiFn = CompendiumApi;
type SpellSearchApiResponse = { rows?: unknown[]; total?: number } | unknown[];
type SpellFacetsApiResponse = { schools?: unknown; classes?: unknown };

const SEARCH_DEBOUNCE_MS = 220;
const FACETS_DEBOUNCE_MS = SEARCH_DEBOUNCE_MS;

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

export function useCompendiumSpellSearch(api: ApiFn, options: { persistFilters?: boolean } = {}) {
  const persistFilters = options.persistFilters !== false;
  const initial = React.useMemo(() => persistFilters
    ? readPersistentFilters("compendium:spells:filters", { q: "", level: "all", schoolFilter: "all", classFilter: "all", filterV: true, filterS: true, filterM: true, filterConcentration: false, filterRitual: false })
    : { q: "", level: "all", schoolFilter: "all", classFilter: "all", filterV: true, filterS: true, filterM: true, filterConcentration: false, filterRitual: false }, [persistFilters]);
  const [q, setQ] = React.useState(initial.q);
  const [level, setLevel] = React.useState<string>(initial.level);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [schoolFilter, setSchoolFilter] = React.useState(initial.schoolFilter);
  const [classFilter, setClassFilter] = React.useState(initial.classFilter);
  const [filterV, setFilterV] = React.useState(initial.filterV);
  const [filterS, setFilterS] = React.useState(initial.filterS);
  const [filterM, setFilterM] = React.useState(initial.filterM);
  const [filterConcentration, setFilterConcentration] = React.useState(initial.filterConcentration);
  const [filterRitual, setFilterRitual] = React.useState(initial.filterRitual);

  React.useEffect(() => {
    if (persistFilters) writePersistentFilters("compendium:spells:filters", { q, level, schoolFilter, classFilter, filterV, filterS, filterM, filterConcentration, filterRitual });
  }, [classFilter, filterConcentration, filterM, filterRitual, filterS, filterV, level, persistFilters, q, schoolFilter]);

  const { availableRulesets, rulesetFilter, setRulesetFilter, showRulesetFilter } =
    useAvailableCompendiumRulesets(api, "spells");

  // Ruleset filter is hidden entirely (and left unapplied) when a category has content in only
  // one ruleset -- nothing to choose between. Defaults to "all rulesets" even when both are
  // present: spells don't have a complete duplicate catalog per ruleset, so silently picking one
  // would hide spells that only exist under the other.

  // The query string the server needs to reproduce the current search. Every filter is applied in
  // SQL, so a result page is correct on its own -- the browser never has to hold the whole
  // catalogue in memory to filter it.
  const searchParams = React.useMemo(() => {
    const params = new URLSearchParams();
    params.set("q", q);
    if (level !== "all") params.set("level", level);
    if (rulesetFilter) params.set("ruleset", rulesetFilter);
    if (schoolFilter !== "all") params.set("school", schoolFilter);
    if (classFilter !== "all") params.set("classes", classFilter);
    if (filterConcentration) params.set("concentration", "1");
    if (filterRitual) params.set("ritual", "1");
    // An unchecked component box means "hide spells that need this component".
    const excluded = [!filterV && "V", !filterS && "S", !filterM && "M"].filter(Boolean);
    if (excluded.length > 0) params.set("excludeComponents", excluded.join(","));
    return params;
  }, [classFilter, filterConcentration, filterM, filterRitual, filterS, filterV, level, q, rulesetFilter, schoolFilter]);

  const requestPage = React.useCallback(async (offset: number, signal: AbortSignal) => {
    const params = new URLSearchParams(searchParams);
    params.set("limit", String(q.trim().length >= 2 ? 180 : 120));
    params.set("offset", String(offset));
    params.set("withTotal", "1");
    params.set("excludeSpecial", "1");
    params.set("compact", "1");
    const res = await api<SpellSearchApiResponse>(`/api/spells/search?${params.toString()}`, { signal });
    const rawRows = Array.isArray(res)
      ? res
      : Array.isArray((res as { rows?: unknown[] }).rows)
        ? (res as { rows: unknown[] }).rows
        : [];
    const rows = rawRows
      .map(normalizeSpellSearchRow)
      .filter((row): row is SpellSearchRow => Boolean(row));
    const rawTotal = Array.isArray(res) ? rawRows.length : Number((res as { total?: unknown }).total);
    return { rows, total: Number.isFinite(rawTotal) ? Number(rawTotal) : rawRows.length };
  }, [api, q, searchParams]);

  const { rows, totalCount, busy, loadingMore, hasMore, loadMore, error } = usePaginatedCompendiumSearch({
    debounceMs: SEARCH_DEBOUNCE_MS,
    refreshKey,
    requestPage,
  });

  // Dropdown options come from the server too. Deriving them from the rows on screen would list
  // only the schools and classes that happen to have been fetched so far.
  const [schoolOptions, setSchoolOptions] = React.useState<string[]>(["all"]);
  const [classOptions, setClassOptions] = React.useState<string[]>(["all"]);

  // Options describe what the *rest* of the search can still narrow to, so they deliberately
  // ignore the school and class selections themselves -- picking "Evocation" shouldn't leave
  // "Evocation" as the only school you can switch to.
  const facetsQuery = React.useMemo(() => {
    const params = new URLSearchParams(searchParams);
    params.delete("school");
    params.delete("classes");
    return params.toString();
  }, [searchParams]);

  React.useEffect(() => {
    const controller = new AbortController();
    // Debounced on the same delay as the result search, so typing a query doesn't fire one facets
    // request per keystroke alongside it.
    const timer = window.setTimeout(() => {
      api<SpellFacetsApiResponse>(`/api/spells/facets?${facetsQuery}`, { signal: controller.signal })
        .then((data) => {
          if (controller.signal.aborted) return;
          const schools = toStringList(data?.schools)
            .sort((a, b) => expandSchool(a).localeCompare(expandSchool(b)));
          setSchoolOptions(["all", ...schools]);
          setClassOptions(["all", ...toStringList(data?.classes)]);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          // Leaving the previous options in place would offer filters that no longer apply.
          setSchoolOptions(["all"]);
          setClassOptions(["all"]);
        });
    }, FACETS_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [api, facetsQuery, refreshKey]);

  // A selection that the current search can no longer offer would silently return nothing, so
  // drop it back to "all" rather than leaving a dead filter applied.
  React.useEffect(() => {
    if (schoolFilter !== "all" && schoolOptions.length > 1 && !schoolOptions.includes(schoolFilter)) {
      setSchoolFilter("all");
    }
  }, [schoolFilter, schoolOptions]);

  React.useEffect(() => {
    if (classFilter !== "all" && classOptions.length > 1 && !classOptions.includes(classFilter)) {
      setClassFilter("all");
    }
  }, [classFilter, classOptions]);

  const hasActiveFilters =
    schoolFilter !== "all" || classFilter !== "all" || filterConcentration || filterRitual || !filterV || !filterS || !filterM || level !== "all" || Boolean(rulesetFilter);

  const clearFilters = React.useCallback(() => {
    setLevel("all");
    setRulesetFilter("");
    setFilterV(true);
    setFilterS(true);
    setFilterM(true);
    setSchoolFilter("all");
    setClassFilter("all");
    setFilterConcentration(false);
    setFilterRitual(false);
  }, [setRulesetFilter]);

  const refresh = React.useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    q,
    setQ,
    level,
    setLevel,
    schoolFilter,
    setSchoolFilter,
    schoolOptions,
    classFilter,
    setClassFilter,
    classOptions,
    filterV,
    setFilterV,
    filterS,
    setFilterS,
    filterM,
    setFilterM,
    filterConcentration,
    setFilterConcentration,
    filterRitual,
    setFilterRitual,
    rulesetFilter,
    setRulesetFilter,
    availableRulesets,
    showRulesetFilter,
    hasActiveFilters,
    clearFilters,
    rows,
    totalCount,
    busy,
    loadingMore,
    hasMore,
    loadMore,
    error,
    refresh,
  };
}
