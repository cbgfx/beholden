// web-dm/src/components/BinderListTable.tsx
//
// Shared building blocks for the Binder's various record-list tables
// (Mortals, Deities, Players, and the generic reference types). Each view still
// owns its own columns/rows/filtering — this only standardizes the header
// (with sorting), the sort-state bookkeeping, and the image-or-placeholder
// thumbnail cell that every one of these lists renders the same way.

import { useState } from "react";
import { theme, withAlpha } from "@/theme/theme";
import { resolveAssetUrl } from "@/services/api";

export type BinderSortDir = "asc" | "desc";

/** Tracks a single (key, direction) sort state — clicking the active column flips direction,
 * clicking a different column selects it ascending. Shared so every list sorts the same way. */
export function useBinderListSort<K extends string>(initialKey: K) {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDir, setSortDir] = useState<BinderSortDir>("asc");
  function toggleSort(key: K) {
    if (key === sortKey) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  return { sortKey, sortDir, toggleSort };
}

export function compareValues(a: string | number | null | undefined, b: string | number | null | undefined, dir: BinderSortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  if (typeof a === "number" || typeof b === "number") {
    return (((a as number) ?? -Infinity) - ((b as number) ?? -Infinity)) * sign;
  }
  return String(a ?? "").localeCompare(String(b ?? "")) * sign;
}

export type BinderListHeaderColumn = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  sortable?: boolean;
};

/** The header row every Binder list table uses: fixed columns laid out via CSS grid,
 * with an optional sort toggle (arrow indicator) per column. */
export function BinderListHeader(props: {
  columns: BinderListHeaderColumn[];
  gridTemplateColumns: string;
  accent: string;
  sortKey?: string;
  sortDir?: BinderSortDir;
  onSort?: (key: string) => void;
}) {
  return (
    <div style={{ minWidth: 1120, display: "grid", gridTemplateColumns: props.gridTemplateColumns, gap: 12, padding: "12px 15px", background: withAlpha(props.accent, 0.08), borderBottom: `1px solid ${theme.colors.panelBorder}` }}>
      {props.columns.map((column) => {
        const active = props.sortKey === column.key;
        const label = (
          <>
            {column.icon}
            {column.label}
            {column.sortable ? (
              <span aria-hidden style={{ fontSize: 11, color: props.accent, opacity: active ? 1 : 0.25 }}>
                {active && props.sortDir === "desc" ? "▼" : "▲"}
              </span>
            ) : null}
          </>
        );
        if (!column.sortable || !props.onSort) {
          return (
            <div key={column.key} style={{ display: "flex", alignItems: "center", gap: 6, color: theme.colors.text, fontSize: "var(--fs-subtitle)", fontWeight: 750 }}>
              {label}
            </div>
          );
        }
        return (
          <button
            key={column.key}
            type="button"
            title={`Sort by ${column.label}`}
            onClick={() => props.onSort!(column.key)}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, justifySelf: "start", border: 0, background: "transparent", padding: 0, margin: 0, color: active ? props.accent : theme.colors.text, fontSize: "var(--fs-subtitle)", fontWeight: 750, font: "inherit", cursor: "pointer" }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** The three states every Binder list table shows in place of its rows: fetching, failed,
 * or nothing matched. Kept as separate small components (rather than one combined status
 * component) since callers need to interleave them with their own `.map()` in a ternary. */
export function BinderListLoading() {
  return <div style={{ padding: 42, textAlign: "center", color: theme.colors.muted }}>Loading…</div>;
}

export function BinderListError(props: { message: string }) {
  return <div role="alert" style={{ padding: 42, textAlign: "center", color: theme.colors.red }}>{props.message}</div>;
}

export function BinderListEmpty(props: { children: React.ReactNode }) {
  return <div style={{ padding: 48, textAlign: "center", color: theme.colors.muted }}>{props.children}</div>;
}

/** The "portrait or accent-tinted box" thumbnail every list row shows next to a record's
 * name — identical rendering everywhere it appears (Mortals, Deities, Players), so the
 * only thing call sites vary is the image url. */
export function BinderRecordThumbnail(props: {
  imageUrl: string | null | undefined;
  imageUpdatedAt?: number | null;
  accent: string;
  size?: number;
}) {
  const size = props.size ?? 34;
  if (!props.imageUrl) {
    return <span style={{ width: size, height: size, borderRadius: 6, background: withAlpha(props.accent, 0.12), flex: "0 0 auto" }} />;
  }
  const src = `${resolveAssetUrl(props.imageUrl)}${props.imageUpdatedAt ? `?v=${props.imageUpdatedAt}` : ""}`;
  return <img src={src} alt="" style={{ width: size, height: size, borderRadius: 6, objectFit: "cover", flex: "0 0 auto" }} />;
}
