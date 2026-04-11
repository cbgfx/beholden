import React from "react";
import { expandSchool } from "./expandSchool";
import { normalizeSpellSearchRow, type SpellSearchRow } from "./normalizeSpellSearchRow";

type ApiFn = <T>(path: string, init?: RequestInit) => Promise<T>;

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

  const [allRows, setAllRows] = React.useState<SpellSearchRow[]>([]);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setBusy(true);
      try {
        const lv = level === "all" ? "" : `&level=${encodeURIComponent(level)}`;
        const res = await api<any[]>(
          `/api/spells/search?q=${encodeURIComponent(q)}&limit=180${lv}&excludeSpecial=1&compact=1`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        const cleaned = (Array.isArray(res) ? res : [])
          .map(normalizeSpellSearchRow)
          .filter((r): r is SpellSearchRow => Boolean(r));
        setAllRows(cleaned);
      } catch {
        if (!controller.signal.aborted) setAllRows([]);
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    };
    const t = window.setTimeout(run, refreshKey === 0 ? 220 : 0);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [api, q, level, refreshKey]);

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
    hasActiveFilters,
    clearFilters,
    rows,
    busy,
    refresh,
  };
}
