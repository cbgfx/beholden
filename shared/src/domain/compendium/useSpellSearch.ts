import React from "react";
import { expandSchool } from "./expandSchool";
import { normalizeSpellSearchRow, type SpellSearchRow } from "./normalizeSpellSearchRow";

type ApiFn = <T>(path: string, init?: RequestInit) => Promise<T>;
type SpellSearchApiResponse = { rows?: unknown[]; total?: number } | unknown[];
type Ruleset = "5e" | "5.5e";
type CompendiumRulesetsResponse = Record<string, Ruleset[]>;

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

  const [availableRulesets, setAvailableRulesets] = React.useState<Ruleset[]>([]);
  const [rulesetFilter, setRulesetFilter] = React.useState<Ruleset | "">("");

  const [allRows, setAllRows] = React.useState<SpellSearchRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  // Ruleset filter is hidden entirely (and left unapplied) when a category has content in only
  // one ruleset -- nothing to choose between. Defaults to 5.5e when both are present.
  React.useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    api<CompendiumRulesetsResponse>("/api/compendium/rulesets", { signal: controller.signal })
      .then((data) => {
        if (!alive) return;
        const available = Array.isArray(data?.spells) ? data.spells : [];
        setAvailableRulesets(available);
        setRulesetFilter(available.length > 1 ? (available.includes("5.5e") ? "5.5e" : available[0]!) : "");
      })
      .catch(() => {
        if (!alive) return;
        setAvailableRulesets([]);
        setRulesetFilter("");
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [api]);

  React.useEffect(() => {
    const controller = new AbortController();
    const run = async () => {
      setBusy(true);
      try {
        const lv = level === "all" ? "" : `&level=${encodeURIComponent(level)}`;
        const rs = rulesetFilter ? `&ruleset=${encodeURIComponent(rulesetFilter)}` : "";
        const hasQuery = q.trim().length >= 2;
        const limit = hasQuery ? 180 : 120;
        const merged: SpellSearchRow[] = [];
        let total = 0;
        let offset = 0;
        const maxRows = 10000;

        while (!controller.signal.aborted) {
          const res = await api<SpellSearchApiResponse>(
            `/api/spells/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&withTotal=1${lv}${rs}&excludeSpecial=1&compact=1`,
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          const pageRows = Array.isArray(res)
            ? res
            : Array.isArray((res as { rows?: unknown[] }).rows)
              ? (res as { rows: unknown[] }).rows
              : [];
          const pageTotal = Array.isArray(res)
            ? pageRows.length
            : Number((res as { total?: unknown }).total);
          total = Number.isFinite(pageTotal) ? Number(pageTotal) : pageRows.length;

          const cleaned = pageRows
            .map(normalizeSpellSearchRow)
            .filter((r): r is SpellSearchRow => Boolean(r));
          merged.push(...cleaned);

          if (cleaned.length === 0) break;
          offset += cleaned.length;
          if (offset >= total) break;
          if (merged.length >= maxRows) break;
        }

        if (controller.signal.aborted) return;
        setAllRows(merged);
        setTotalCount(total || merged.length);
      } catch {
        if (!controller.signal.aborted) {
          setAllRows([]);
          setTotalCount(0);
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    };
    const t = window.setTimeout(run, refreshKey === 0 ? 220 : 0);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [api, q, level, rulesetFilter, refreshKey]);

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
    showRulesetFilter: availableRulesets.length > 1,
    hasActiveFilters,
    clearFilters,
    rows,
    totalCount,
    busy,
    refresh,
  };
}
