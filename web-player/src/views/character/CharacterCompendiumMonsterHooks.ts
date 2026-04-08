import { useEffect, useMemo, useState } from "react";
import { api } from "@/services/api";
import { parseCrNumber } from "@/lib/monsterPicker/utils";
import type { CompendiumMonsterRow } from "@/lib/monsterPicker/types";

export function useCompendiumMonster(monsterId: string | null | undefined, missingMessage: string) {
  const [monster, setMonster] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!monsterId) {
      setMonster(null);
      setBusy(false);
      setError(null);
      return;
    }
    let alive = true;
    setBusy(true);
    setError(null);
    api<any>(`/api/compendium/monsters/${encodeURIComponent(monsterId)}`)
      .then((data) => { if (alive) setMonster(data); })
      .catch((e) => {
        if (alive) {
          setMonster(null);
          setError(e?.message ?? missingMessage);
        }
      })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [monsterId, missingMessage]);

  return { monster, busy, error };
}

export function filterPolymorphRows(args: {
  rows: CompendiumMonsterRow[];
  query: string;
  typeFilter: string;
  crMax: string;
}) {
  const { rows, query, typeFilter, crMax } = args;
  const normalizedQuery = query.trim().toLowerCase();
  const maxCr = crMax ? parseCrNumber(crMax) : NaN;
  return rows
    .filter((row) => {
      if (normalizedQuery && !String(row.name ?? "").toLowerCase().includes(normalizedQuery)) return false;
      const type = String(row.type ?? "").trim().toLowerCase();
      if (typeFilter !== "all" && type !== typeFilter) return false;
      if (Number.isFinite(maxCr)) {
        const rowCr = parseCrNumber(row.cr);
        if (!Number.isFinite(rowCr) || rowCr > maxCr) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const crDiff = parseCrNumber(a.cr) - parseCrNumber(b.cr);
      if (Number.isFinite(crDiff) && Math.abs(crDiff) > 1e-9) return crDiff;
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
}

export function useFilteredPolymorphRows(args: {
  rows: CompendiumMonsterRow[];
  query: string;
  typeFilter: string;
  crMax: string;
}) {
  return useMemo(() => filterPolymorphRows(args), [args]);
}
