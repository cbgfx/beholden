import * as React from "react";
import type { CompendiumMonsterRow, PreparedMonsterRow, SortMode } from "@/views/CampaignView/monsterPicker/types";
import { parseCrNumber } from "@/views/CampaignView/monsterPicker/utils";

// Canonical size order for the dropdown.
export const SIZE_LABELS = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"] as const;

const SIZE_CODE_MAP: Record<string, string> = {
  T: "Tiny",
  S: "Small",
  M: "Medium",
  L: "Large",
  H: "Huge",
  G: "Gargantuan",
};

function resolveSizeLabel(raw: string | undefined): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Single-letter code (most common from compendium data).
  if (SIZE_CODE_MAP[trimmed.toUpperCase()]) return SIZE_CODE_MAP[trimmed.toUpperCase()];
  // Already a full name — normalise capitalisation.
  const lower = trimmed.toLowerCase();
  for (const label of SIZE_LABELS) {
    if (label.toLowerCase() === lower) return label;
  }
  return trimmed; // Unknown — pass through as-is.
}

export function useMonsterPickerRows(args: {
  rows: CompendiumMonsterRow[];
  compQ: string;
  sortMode: SortMode;
  envFilter: string;
  crMin: string;
  crMax: string;
  sizeFilter: string;
}) {
  const deferredCompQ = React.useDeferredValue(args.compQ);

  const preparedRows = React.useMemo<PreparedMonsterRow[]>(() => {
    return args.rows.map((m) => {
      const name = String(m.name ?? "");
      const envRaw = String(m?.environment ?? "").trim();
      const envParts = envRaw
        ? envRaw
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean)
        : [];

      const first = name.trim().charAt(0).toUpperCase();
      const firstLetter = first >= "A" && first <= "Z" ? first : "#";

      return {
        ...m,
        nameLower: name.toLowerCase(),
        envParts,
        envPartsLower: envParts.map((e) => e.toLowerCase()),
        crNum: parseCrNumber(m.cr),
        firstLetter,
        sizeLabel: resolveSizeLabel(m.size),
      };
    });
  }, [args.rows]);

  const rowsAz = React.useMemo(() => {
    const a = [...preparedRows];
    a.sort((x, y) => x.nameLower.localeCompare(y.nameLower));
    return a;
  }, [preparedRows]);

  const rowsCrAsc = React.useMemo(() => {
    const a = [...preparedRows];
    a.sort((x, y) => {
      const ax = x.crNum;
      const by = y.crNum;
      const aOk = Number.isFinite(ax);
      const bOk = Number.isFinite(by);
      if (!aOk && !bOk) return x.nameLower.localeCompare(y.nameLower);
      if (!aOk) return 1;
      if (!bOk) return -1;
      const d = ax! - by!;
      return d !== 0 ? d : x.nameLower.localeCompare(y.nameLower);
    });
    return a;
  }, [preparedRows]);

  const rowsCrDesc = React.useMemo(() => [...rowsCrAsc].reverse(), [rowsCrAsc]);

  const envOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of preparedRows) {
      for (const e of m.envParts) set.add(e);
    }
    return ["all", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [preparedRows]);

  // Size options: fixed canonical order, only include sizes present in the list.
  const sizeOptions = React.useMemo(() => {
    const present = new Set<string>();
    for (const m of preparedRows) {
      if (m.sizeLabel) present.add(m.sizeLabel);
    }
    return ["all", ...SIZE_LABELS.filter((s) => present.has(s))];
  }, [preparedRows]);

  const filteredRows = React.useMemo(() => {
    const q = deferredCompQ.trim().toLowerCase();
    const envLower = args.envFilter.toLowerCase();
    const sizeActive = args.sizeFilter !== "all";

    const min = args.crMin.trim() ? parseCrNumber(args.crMin.trim()) : NaN;
    const max = args.crMax.trim() ? parseCrNumber(args.crMax.trim()) : NaN;

    const baseSorted = args.sortMode === "az" ? rowsAz : args.sortMode === "crAsc" ? rowsCrAsc : rowsCrDesc;

    const hasQ = !!q;
    const hasEnv = args.envFilter !== "all";
    const hasCr = Number.isFinite(min) || Number.isFinite(max);

    if (!hasQ && !hasEnv && !hasCr && !sizeActive) return baseSorted;

    return baseSorted.filter((m) => {
      if (hasQ && !m.nameLower.includes(q)) return false;

      if (hasEnv) {
        let ok = false;
        for (const e of m.envPartsLower) {
          if (e === envLower) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }

      if (hasCr) {
        const v = m.crNum;
        if (v == null || !Number.isFinite(v)) return false;
        if (Number.isFinite(min) && v < min) return false;
        if (Number.isFinite(max) && v > max) return false;
      }

      if (sizeActive && m.sizeLabel !== args.sizeFilter) return false;

      return true;
    });
  }, [rowsAz, rowsCrAsc, rowsCrDesc, args.sortMode, args.envFilter, args.crMin, args.crMax, args.sizeFilter, deferredCompQ]);

  const lettersInList = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of filteredRows) {
      if (m.firstLetter !== "#") set.add(m.firstLetter);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filteredRows]);

  const letterFirstIndex = React.useMemo(() => {
    const out: Record<string, number> = {};
    for (let i = 0; i < filteredRows.length; i++) {
      const L = filteredRows[i].firstLetter;
      if (L === "#") continue;
      if (out[L] == null) out[L] = i;
    }
    return out;
  }, [filteredRows]);

  return {
    deferredCompQ,
    preparedRows,
    envOptions,
    sizeOptions,
    filteredRows,
    lettersInList,
    letterFirstIndex
  };
}
