// web-dm/src/components/BinderListTable.tsx
//
// Shared building blocks for the Binder's various record-list tables
// (Mortals, Deities, Players, and the generic reference types). Each view still
// owns its own columns/rows/filtering — this only standardizes the header
// (with sorting), the sort-state bookkeeping, and the image-or-placeholder
// thumbnail cell that every one of these lists renders the same way.

import { BinderDataTableHeader, BinderDataTableThumbnail, compareBinderTableValues, useBinderDataTableSort, type BinderSortDir } from "@beholden/shared/ui";
import { theme } from "@/theme/theme";
import { resolveAssetUrl } from "@/services/api";

export type { BinderSortDir } from "@beholden/shared/ui";

/** Tracks a single (key, direction) sort state — clicking the active column flips direction,
 * clicking a different column selects it ascending. Shared so every list sorts the same way. */
export function useBinderListSort<K extends string>(initialKey: K) {
  return useBinderDataTableSort(initialKey);
}

export function compareValues(a: string | number | null | undefined, b: string | number | null | undefined, dir: BinderSortDir): number {
  return compareBinderTableValues(a, b, dir);
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
  return <BinderDataTableHeader {...props} theme={{ text: theme.colors.text, muted: theme.colors.muted, border: theme.colors.panelBorder }} />;
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
  return <BinderDataTableThumbnail {...props} resolveUrl={(url) => resolveAssetUrl(url) ?? url} />;
}
