import * as React from "react";
import { api } from "../../api/browserClient";
import { useAvailableRulesets } from "./useAvailableRulesets";
import { SIZE_LABELS, type CompendiumMonsterRow, type SortMode } from "./monsterPicker";

/** Shared read-only browser state; editing stays in the DM panel. */
export function useMonsterBrowser() {
  const [rows, setRows] = React.useState<CompendiumMonsterRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [totalRows, setTotalRows] = React.useState(0);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [envOptions, setEnvOptions] = React.useState<string[]>(["all"]);
  const [sizeOptions, setSizeOptions] = React.useState<string[]>(["all"]);
  const [typeOptions, setTypeOptions] = React.useState<string[]>(["all"]);

  const refresh = React.useCallback(() => setRefreshKey((value) => value + 1), []);

  const [compQ, setCompQ] = React.useState("");
  const [sortMode, setSortMode] = React.useState<SortMode>("az");
  const [envFilter, setEnvFilter] = React.useState("all");
  const [sizeFilter, setSizeFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [crMin, setCrMin] = React.useState("");
  const [crMax, setCrMax] = React.useState("");
  const { rulesetFilter, setRulesetFilter, showRulesetFilter } = useAvailableRulesets(api, "monsters");

  React.useEffect(() => {
    const controller = new AbortController();
    api<{ environments: string[]; sizes: string[]; types: string[] }>("/api/compendium/monsters/facets", {
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
  }, [refreshKey]);

  React.useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const limit =
          compQ.trim().length >= 2
          || envFilter !== "all"
          || sizeFilter !== "all"
          || typeFilter !== "all"
          || Boolean(crMin.trim())
          || Boolean(crMax.trim())
            ? 200
            : 120;
        const merged: CompendiumMonsterRow[] = [];
        let total = 0;
        let offset = 0;
        const maxRows = 10000;

        while (!controller.signal.aborted) {
          const params = new URLSearchParams({
            q: compQ,
            limit: String(limit),
            offset: String(offset),
            withTotal: "1",
            sort: sortMode,
            fields: "id,name,cr,type,environment",
          });
          if (envFilter !== "all") params.set("env", envFilter);
          if (sizeFilter !== "all") params.set("sizes", sizeFilter);
          if (typeFilter !== "all") params.set("types", typeFilter);
          if (crMin.trim()) params.set("crMin", crMin.trim());
          if (crMax.trim()) params.set("crMax", crMax.trim());
          if (rulesetFilter) params.set("ruleset", rulesetFilter);

          const result = await api<{ rows: CompendiumMonsterRow[]; total: number }>(
            `/api/compendium/search?${params.toString()}`,
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;

          const nextRows = Array.isArray(result?.rows) ? result.rows : [];
          total = Number.isFinite(result?.total as number) ? Number(result.total) : nextRows.length;
          merged.push(...nextRows);

          if (nextRows.length === 0) break;
          offset += nextRows.length;
          if (offset >= total) break;
          if (merged.length >= maxRows) break;
        }

        if (controller.signal.aborted) return;
        setRows(merged);
        setTotalRows(total || merged.length);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRows([]);
        setTotalRows(0);
        setLoadError(String((error as any)?.message ?? error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [compQ, sortMode, envFilter, sizeFilter, typeFilter, crMin, crMax, rulesetFilter, refreshKey]);

  const filteredRows = rows;

  const normalizeSortName = React.useCallback((name: string) => {
    return name
      .trim()
      .replace(/^[^a-z0-9]+/i, "")
      .replace(/^the\s+/i, "")
      .trim();
  }, []);

  const lettersInList = React.useMemo(() => {
    const set = new Set<string>();
    for (const row of filteredRows) {
      const first = normalizeSortName(String(row.name ?? "")).charAt(0).toUpperCase();
      if (first >= "A" && first <= "Z") set.add(first);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredRows, normalizeSortName]);

  const letterFirstIndex = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (let i = 0; i < filteredRows.length; i += 1) {
      const first = normalizeSortName(String(filteredRows[i].name ?? "")).charAt(0).toUpperCase();
      if (!(first >= "A" && first <= "Z")) continue;
      if (out[first] == null) out[first] = i;
    }
    return out;
  }, [filteredRows, normalizeSortName]);

  return { filteredRows, loading, loadError, totalRows, envOptions, sizeOptions, typeOptions, refresh, compQ, setCompQ, sortMode, setSortMode, envFilter, setEnvFilter, sizeFilter, setSizeFilter, typeFilter, setTypeFilter, crMin, setCrMin, crMax, setCrMax, rulesetFilter, setRulesetFilter, showRulesetFilter, lettersInList, letterFirstIndex };
}
