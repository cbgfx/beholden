import React from "react";
import { api } from "@/services/api";
import { expandSchool } from "@/lib/format/expandSchool";
import { normalizeSpellSearchRow, type SpellSearchRow } from "@/domain/compendium/normalizeSpellSearchRow";

function hasComponent(components: string | null, letter: string): boolean {
  if (!components) return false;
  return components.split(",").some((part) => part.trim().charAt(0).toUpperCase() === letter);
}

function stripSchoolPrefix(classes: string | null): string {
  if (!classes) return "";
  return classes.replace(/^School:\s*[^,]+,\s*/i, "");
}

export function useSpellSearch() {
  const [q, setQ]         = React.useState("");
  const [level, setLevel] = React.useState<string>("all");
  const [refreshKey, setRefreshKey] = React.useState(0);

  const [schoolFilter, setSchoolFilter]               = React.useState("all");
  const [classFilter, setClassFilter]                 = React.useState("all");
  const [filterV, setFilterV]                         = React.useState(true);
  const [filterS, setFilterS]                         = React.useState(true);
  const [filterM, setFilterM]                         = React.useState(true);
  const [filterConcentration, setFilterConcentration] = React.useState(false);
  const [filterRitual, setFilterRitual]               = React.useState(false);

  const [allRows, setAllRows] = React.useState<SpellSearchRow[]>([]);
  const [busy, setBusy]       = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setBusy(true);
      try {
        const lv = level === "all" ? "" : `&level=${encodeURIComponent(level)}`;
        const res = await api<any[]>(`/api/spells/search?q=${encodeURIComponent(q)}&limit=500${lv}`);
        if (cancelled) return;
        const cleaned = (Array.isArray(res) ? res : [])
          .map(normalizeSpellSearchRow)
          .filter((r): r is SpellSearchRow => Boolean(r));
        setAllRows(cleaned);
      } catch {
        if (!cancelled) setAllRows([]);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    const t = window.setTimeout(run, refreshKey === 0 ? 120 : 0);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [q, level, refreshKey]);

  const schoolOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const r of allRows) { if (r.school) seen.add(r.school); }
    return ["all", ...Array.from(seen).sort((a, b) => expandSchool(a).localeCompare(expandSchool(b)))];
  }, [allRows]);

  const classOptions = React.useMemo(() => {
    const seen = new Set<string>();
    for (const r of allRows) {
      for (const cls of stripSchoolPrefix(r.classes).split(",")) {
        const t = cls.trim();
        if (t) seen.add(t);
      }
    }
    return ["all", ...Array.from(seen).sort()];
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
  }, [allRows, schoolFilter, classFilter, filterV, filterS, filterM, filterConcentration, filterRitual]);

  const hasActiveFilters =
    schoolFilter !== "all" || classFilter !== "all" || filterConcentration || filterRitual;

  function clearFilters() {
    setSchoolFilter("all");
    setClassFilter("all");
    setFilterConcentration(false);
    setFilterRitual(false);
  }

  return {
    q, setQ, level, setLevel,
    schoolFilter, setSchoolFilter, schoolOptions,
    classFilter, setClassFilter, classOptions,
    filterV, setFilterV, filterS, setFilterS, filterM, setFilterM,
    filterConcentration, setFilterConcentration,
    filterRitual, setFilterRitual,
    hasActiveFilters, clearFilters,
    rows, busy,
    refresh: () => setRefreshKey((k) => k + 1),
  };
}
