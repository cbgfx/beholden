import { useState } from "react";

export type BinderSortDir = "asc" | "desc";

export const BINDER_MORTAL_COLUMNS = "repeat(5, minmax(150px, 1fr)) 72px 96px 72px 38px";

export type BinderDataTableTheme = {
  text: string;
  muted: string;
  border: string;
};

export type BinderDataTableColumn = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  sortable?: boolean;
};

export function useBinderDataTableSort<K extends string>(initialKey: K) {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDir, setSortDir] = useState<BinderSortDir>("asc");
  function toggleSort(key: K) {
    if (key === sortKey) setSortDir((value) => value === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }
  return { sortKey, sortDir, toggleSort };
}

export function compareBinderTableValues(a: string | number | null | undefined, b: string | number | null | undefined, dir: BinderSortDir) {
  const sign = dir === "asc" ? 1 : -1;
  if (typeof a === "number" || typeof b === "number") return (((a as number) ?? -Infinity) - ((b as number) ?? -Infinity)) * sign;
  return String(a ?? "").localeCompare(String(b ?? "")) * sign;
}

export function BinderDataTableHeader(props: {
  columns: BinderDataTableColumn[];
  gridTemplateColumns: string;
  accent: string;
  theme: BinderDataTableTheme;
  sortKey?: string;
  sortDir?: BinderSortDir;
  onSort?: (key: string) => void;
}) {
  return <div style={{ minWidth: 1120, display: "grid", gridTemplateColumns: props.gridTemplateColumns, gap: 10, padding: "8px 12px", background: `color-mix(in srgb, ${props.accent} 8%, transparent)`, borderBottom: `1px solid ${props.theme.border}` }}>
    {props.columns.map((column) => {
      const active = props.sortKey === column.key;
      const content = <>{column.icon}{column.label}{column.sortable ? <span aria-hidden style={{ fontSize: 11, color: props.accent, opacity: active ? 1 : .25 }}>{active && props.sortDir === "desc" ? "▼" : "▲"}</span> : null}</>;
      return column.sortable && props.onSort
        ? <button key={column.key} type="button" title={`Sort by ${column.label}`} onClick={() => props.onSort!(column.key)} style={{ display: "inline-flex", alignItems: "center", gap: 5, justifySelf: "start", border: 0, background: "transparent", padding: 0, margin: 0, color: active ? props.accent : props.theme.text, font: "inherit", fontSize: "calc(var(--fs-small) + 1px)", fontWeight: 750, cursor: "pointer" }}>{content}</button>
        : <div key={column.key} style={{ display: "flex", alignItems: "center", gap: 5, color: props.theme.text, fontSize: "calc(var(--fs-small) + 1px)", fontWeight: 750 }}>{content}</div>;
    })}
  </div>;
}

export function BinderDataTableRow(props: React.PropsWithChildren<{
  gridTemplateColumns: string;
  theme: BinderDataTableTheme;
  onClick?: () => void;
  background?: string;
  as?: "button" | "div";
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}>) {
  const style: React.CSSProperties = { minWidth: 1160, width: "100%", display: "grid", gridTemplateColumns: props.gridTemplateColumns, gap: 10, alignItems: "center", padding: "6px 12px", border: 0, borderTop: `1px solid ${props.theme.border}`, background: props.background ?? "transparent", color: props.theme.text, textAlign: "left", cursor: props.onClick ? "pointer" : "default", font: "inherit", fontSize: "calc(var(--fs-small) + 1px)" };
  return props.as === "div" ? <div role={props.onClick ? "button" : undefined} tabIndex={props.onClick ? 0 : undefined} onClick={props.onClick} onKeyDown={(event) => { if (props.onClick && (event.key === "Enter" || event.key === " ")) props.onClick(); }} onMouseEnter={props.onMouseEnter} onMouseLeave={props.onMouseLeave} style={style}>{props.children}</div> : <button type="button" onClick={props.onClick} onMouseEnter={props.onMouseEnter} onMouseLeave={props.onMouseLeave} style={style}>{props.children}</button>;
}

export function BinderDataTableThumbnail(props: { imageUrl?: string | null; imageUpdatedAt?: number | null; accent: string; size?: number; resolveUrl?: (url: string) => string }) {
  const size = props.size ?? 28;
  if (!props.imageUrl) return <span style={{ width: size, height: size, borderRadius: 6, background: `color-mix(in srgb, ${props.accent} 12%, transparent)`, flex: "0 0 auto" }} />;
  const base = props.resolveUrl ? props.resolveUrl(props.imageUrl) : props.imageUrl;
  return <img src={`${base}${props.imageUpdatedAt ? `?v=${props.imageUpdatedAt}` : ""}`} alt="" style={{ width: size, height: size, borderRadius: 6, objectFit: "cover", flex: "0 0 auto" }} />;
}
