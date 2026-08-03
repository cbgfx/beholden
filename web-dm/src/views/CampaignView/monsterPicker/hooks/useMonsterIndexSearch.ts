import * as React from "react";
import { api } from "@/services/api";
import { useAvailableRulesets } from "@beholden/shared/domain/compendium/useAvailableRulesets";
import type { CompendiumMonsterRow, SortMode } from "@/views/CampaignView/monsterPicker/types";
import { SIZE_LABELS } from "@/views/CampaignView/monsterPicker/hooks/useMonsterPickerRows";

function normalizeMonsterSortName(name: string): string {
  return name.trim().replace(/^[^a-z0-9]+/i, "").replace(/^the\s+/i, "").trim();
}

export function useMonsterIndexSearch(args: { isOpen: boolean; query: string }) {
  const { isOpen, query } = args;
  const [sortMode, setSortMode] = React.useState<SortMode>("az");
  const [envFilter, setEnvFilter] = React.useState("all");
  const [sizeFilter, setSizeFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [crMin, setCrMin] = React.useState("");
  const [crMax, setCrMax] = React.useState("");
  const { rulesetFilter, setRulesetFilter, showRulesetFilter } =
    useAvailableRulesets(api, "monsters", isOpen);
  const [filteredRows, setFilteredRows] = React.useState<CompendiumMonsterRow[]>([]);
  const [loadingIndex, setLoadingIndex] = React.useState(false);
  const [indexError, setIndexError] = React.useState<string | null>(null);
  const [envOptions, setEnvOptions] = React.useState<string[]>(["all"]);
  const [sizeOptions, setSizeOptions] = React.useState<string[]>(["all"]);
  const [typeOptions, setTypeOptions] = React.useState<string[]>(["all"]);

  React.useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    api<{ environments: string[]; sizes: string[]; types: string[] }>(
      "/api/compendium/monsters/facets",
      { signal: controller.signal },
    ).then((data) => {
      const sizeOrder = new Map<string, number>(SIZE_LABELS.map((size, index) => [size, index]));
      const sizes = [...(Array.isArray(data?.sizes) ? data.sizes : [])].sort((a, b) => {
        const aOrder = sizeOrder.get(a);
        const bOrder = sizeOrder.get(b);
        if (aOrder != null && bOrder != null) return aOrder - bOrder;
        if (aOrder != null) return -1;
        if (bOrder != null) return 1;
        return a.localeCompare(b);
      });
      setEnvOptions(["all", ...(Array.isArray(data?.environments) ? data.environments : [])]);
      setSizeOptions(["all", ...sizes]);
      setTypeOptions(["all", ...(Array.isArray(data?.types) ? data.types : [])]);
    }).catch(() => {
      if (controller.signal.aborted) return;
      setEnvOptions(["all"]);
      setSizeOptions(["all"]);
      setTypeOptions(["all"]);
    });
    return () => controller.abort();
  }, [isOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingIndex(true);
      setIndexError(null);
      try {
        const pageSize = 200;
        const params = new URLSearchParams({
          q: query,
          limit: String(pageSize),
          offset: "0",
          sort: sortMode,
          fields: "id,name,cr,type,environment",
        });
        if (envFilter !== "all") params.set("env", envFilter);
        if (sizeFilter !== "all") params.set("sizes", sizeFilter);
        if (typeFilter !== "all") params.set("types", typeFilter);
        if (crMin.trim()) params.set("crMin", crMin.trim());
        if (crMax.trim()) params.set("crMax", crMax.trim());
        if (rulesetFilter) params.set("ruleset", rulesetFilter);
        const rows: CompendiumMonsterRow[] = [];
        for (let offset = 0; ; offset += pageSize) {
          params.set("offset", String(offset));
          const page = await api<CompendiumMonsterRow[]>(
            `/api/compendium/search?${params.toString()}`,
            { signal: controller.signal },
          );
          if (controller.signal.aborted) return;
          if (!Array.isArray(page)) break;
          rows.push(...page);
          if (page.length < pageSize) break;
        }
        setFilteredRows(rows);
      } catch (error) {
        if (controller.signal.aborted) return;
        setFilteredRows([]);
        setIndexError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!controller.signal.aborted) setLoadingIndex(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query, sortMode, envFilter, sizeFilter, typeFilter, crMin, crMax, rulesetFilter]);

  const { lettersInList, letterFirstIndex } = React.useMemo(() => {
    const letters = new Set<string>();
    const firstIndexes: Record<string, number> = {};
    filteredRows.forEach((row, index) => {
      const first = normalizeMonsterSortName(String(row.name ?? "")).charAt(0).toUpperCase();
      if (first < "A" || first > "Z") return;
      letters.add(first);
      if (firstIndexes[first] == null) firstIndexes[first] = index;
    });
    return {
      lettersInList: Array.from(letters).sort((a, b) => a.localeCompare(b)),
      letterFirstIndex: firstIndexes,
    };
  }, [filteredRows]);
  const listScrollToIndexRef = React.useRef<((index: number) => void) | null>(null);
  const onJumpToLetter = React.useCallback((letter: string) => {
    const index = letterFirstIndex[letter];
    if (index != null) listScrollToIndexRef.current?.(index);
  }, [letterFirstIndex]);

  return {
    sortMode, setSortMode, envFilter, setEnvFilter, envOptions,
    sizeFilter, setSizeFilter, sizeOptions, typeFilter, setTypeFilter, typeOptions,
    crMin, setCrMin, crMax, setCrMax, rulesetFilter, setRulesetFilter, showRulesetFilter,
    filteredRows, loadingIndex, indexError, lettersInList, onJumpToLetter, listScrollToIndexRef,
    clearFilters: () => {
      setEnvFilter("all");
      setSizeFilter("all");
      setTypeFilter("all");
      setCrMin("");
      setCrMax("");
      setSortMode("az");
    },
  };
}
