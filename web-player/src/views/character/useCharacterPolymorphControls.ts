import React from "react";
import { api } from "@/services/api";
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";

export function useCharacterPolymorphControls(open: boolean) {
  const [polymorphQuery, setPolymorphQuery] = React.useState("");
  const [polymorphTypeFilter, setPolymorphTypeFilter] = React.useState("beast");
  const [polymorphCrMax, setPolymorphCrMax] = React.useState("");
  const [polymorphTypeOptions, setPolymorphTypeOptions] = React.useState<string[]>(["all", "beast"]);
  const [filteredPolymorphRows, setFilteredPolymorphRows] = React.useState<CompendiumMonsterRow[]>([]);
  const [polymorphRowsBusy, setPolymorphRowsBusy] = React.useState(false);
  const [polymorphRowsError, setPolymorphRowsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    api<{ types: string[] }>("/api/compendium/monsters/facets")
      .then((facets) => {
        if (!alive) return;
        const types = Array.isArray(facets?.types) ? facets.types : [];
        const normalized = types
          .map((type) => String(type ?? "").trim().toLowerCase())
          .filter(Boolean);
        const nextOptions = ["all", ...Array.from(new Set(normalized)).sort((a, b) => a.localeCompare(b))];
        setPolymorphTypeOptions(nextOptions.length > 1 ? nextOptions : ["all", "beast"]);
      })
      .catch(() => {
        if (!alive) return;
        setPolymorphTypeOptions((prev) => (prev.length > 0 ? prev : ["all", "beast"]));
      });
    return () => {
      alive = false;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setFilteredPolymorphRows([]);
      setPolymorphRowsBusy(false);
      setPolymorphRowsError(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPolymorphRowsBusy(true);
      setPolymorphRowsError(null);
      try {
        const params = new URLSearchParams({
          q: polymorphQuery.trim(),
          sort: "az",
          limit:
            polymorphQuery.trim().length >= 2
            || polymorphTypeFilter !== "all"
            || Boolean(polymorphCrMax.trim())
              ? "200"
              : "120",
        });
        if (polymorphTypeFilter !== "all") params.set("types", polymorphTypeFilter);
        if (polymorphCrMax.trim()) params.set("crMax", polymorphCrMax.trim());
        const rows = await api<CompendiumMonsterRow[]>(`/api/compendium/search?${params.toString()}`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setFilteredPolymorphRows(Array.isArray(rows) ? rows : []);
      } catch (e: any) {
        if (controller.signal.aborted) return;
        setFilteredPolymorphRows([]);
        setPolymorphRowsError(e?.message ?? "Failed to load creatures.");
      } finally {
        if (!controller.signal.aborted) setPolymorphRowsBusy(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, polymorphCrMax, polymorphQuery, polymorphTypeFilter]);

  return {
    polymorphQuery,
    setPolymorphQuery,
    polymorphTypeFilter,
    setPolymorphTypeFilter,
    polymorphCrMax,
    setPolymorphCrMax,
    polymorphTypeOptions,
    filteredPolymorphRows,
    polymorphRowsBusy,
    polymorphRowsError,
  };
}
