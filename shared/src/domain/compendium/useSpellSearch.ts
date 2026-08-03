import React from "react";
import { expandSchool } from "./expandSchool";
import { normalizeSpellSearchRow, type SpellSearchRow } from "./normalizeSpellSearchRow";
import {
  useAvailableCompendiumRulesets,
  usePaginatedCompendiumSearch,
  type CompendiumApi,
} from "./usePaginatedCompendiumSearch";

type ApiFn = CompendiumApi;
type SpellSearchApiResponse = { rows?: unknown[]; total?: number } | unknown[];

function hasComponent(components: string | null, letter: string): boolean {
  if (!components) return false;
  return components.split(",").some((part) => part.trim().charAt(0).toUpperCase() === letter);
}

function stripSchoolPrefix(classes: string | null): string {
  if (!classes) return "";
  return classes.replace(/^School:\s*[^,]+,\s*/i, "");
}

export function useCompendiumSpellSearch(api: ApiFn) {
  const [q, setQ] = React.useState("");
  const [level, setLevel] = React.useState<string>("all");
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [schoolFilter, setSchoolFilter] = React.useState("all");
  const [classFilter, setClassFilter] = React.useState("all");
  const [filterV, setFilterV] = React.useState(true);
  const [filterS, setFilterS] = React.useState(true);
  const [filterM, setFilterM] = React.useState(true);
  const [filterConcentration, setFilterConcentration] = React.useState(false);
  const [filterRitual, setFilterRitual] = React.useState(false);

  const { availableRulesets, rulesetFilter, setRulesetFilter, showRulesetFilter } =
    useAvailableCompendiumRulesets(api, "spells");

  // Ruleset filter is hidden entirely (and left unapplied) when a category has content in only
  // one ruleset -- nothing to choose between. Defaults to "all rulesets" even when both are
  // present: spells don't have a complete duplicate catalog per ruleset, so silently picking one
  // would hide spells that only exist under the other.
  const requestPage = React.useCallback(async (offset: number, signal: AbortSignal) => {
    const lv = level === "all" ? "" : `&level=${encodeURIComponent(level)}`;
    const rs = rulesetFilter ? `&ruleset=${encodeURIComponent(rulesetFilter)}` : "";
    const limit = q.trim().length >= 2 ? 180 : 120;
    const res = await api<SpellSearchApiResponse>(
      `/api/spells/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&withTotal=1${lv}${rs}&excludeSpecial=1&compact=1`,
      { signal },
    );
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
  }, [api, level, q, rulesetFilter]);
  const { rows: allRows, totalCount, busy } = usePaginatedCompendiumSearch({
    debounceMs: refreshKey === 0 ? 220 : 0,
    refreshKey,
    requestPage,
  });

  const schoolOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const r of allRows) if (r.school) seen.add(r.school);
    return [
      "all",
      ...Array.from(seen).sort((a, b) => expandSchool(a).localeCompare(expandSchool(b))),
    ];
  }, [allRows]);

  const classOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const r of allRows) {
      const raw = stripSchoolPrefix(r.classes);
      for (const cls of raw.split(",")) {
        const trimmed = cls.trim();
        if (trimmed) seen.add(trimmed);
      }
    }
    return ["all", ...Array.from(seen).sort((a, b) => a.localeCompare(b))];
  }, [allRows]);

  const rows = React.useMemo(() => {
    return allRows.filter((r) => {
      if (schoolFilter !== "all" && r.school !== schoolFilter) return false;
      if (classFilter !== "all") {
        const classes = stripSchoolPrefix(r.classes).split(",").map((c) => c.trim());
        if (!classes.includes(classFilter)) return false;
      }
      if (!filterV && hasComponent(r.components, "V")) return false;
      if (!filterS && hasComponent(r.components, "S")) return false;
      if (!filterM && hasComponent(r.components, "M")) return false;
      if (filterConcentration && !r.concentration) return false;
      if (filterRitual && !r.ritual) return false;
      return true;
    });
  }, [
    allRows,
    schoolFilter,
    classFilter,
    filterV,
    filterS,
    filterM,
    filterConcentration,
    filterRitual,
  ]);

  const hasActiveFilters =
    schoolFilter !== "all" || classFilter !== "all" || filterConcentration || filterRitual;

  const clearFilters = React.useCallback(() => {
    setSchoolFilter("all");
    setClassFilter("all");
    setFilterConcentration(false);
    setFilterRitual(false);
  }, []);

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
    refresh,
  };
}
