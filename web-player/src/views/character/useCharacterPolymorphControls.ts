import React from "react";
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";
import { filterPolymorphRows } from "@/views/character/CharacterCompendiumMonsterHooks";

export function useCharacterPolymorphControls(rows: CompendiumMonsterRow[]) {
  const [polymorphQuery, setPolymorphQuery] = React.useState("");
  const [polymorphTypeFilter, setPolymorphTypeFilter] = React.useState("beast");
  const [polymorphCrMax, setPolymorphCrMax] = React.useState("");

  const polymorphTypeOptions = React.useMemo(() => {
    const values = new Set<string>();
    for (const row of rows) {
      const type = String(row.type ?? "").trim().toLowerCase();
      if (type) values.add(type);
    }
    return ["all", ...Array.from(values).sort()];
  }, [rows]);

  const filteredPolymorphRows = React.useMemo(
    () => filterPolymorphRows({
      rows,
      query: polymorphQuery,
      typeFilter: polymorphTypeFilter,
      crMax: polymorphCrMax,
    }),
    [rows, polymorphQuery, polymorphTypeFilter, polymorphCrMax],
  );

  return {
    polymorphQuery,
    setPolymorphQuery,
    polymorphTypeFilter,
    setPolymorphTypeFilter,
    polymorphCrMax,
    setPolymorphCrMax,
    polymorphTypeOptions,
    filteredPolymorphRows,
  };
}
