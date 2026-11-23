import type { CSSProperties } from "react";
import { withAlpha } from "./colors";

/** Controlled display only: each Binder owns its filters and available choices. */
export function BinderFilterChips<K extends string>(props: {
  filters: Record<K, string[]>;
  label: (key: K) => string;
  valueLabel?: (key: K, value: string) => string;
  removeLabel: (label: string, value: string) => string;
  onRemove: (key: K, value: string) => void;
  accent: string;
  theme: { text: string; red: string };
  style?: CSSProperties;
}) {
  const entries = Object.entries(props.filters) as Array<[K, string[]]>;
  if (!entries.some(([, values]) => values.length)) return null;
  return <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center", ...props.style }}>
    {entries.flatMap(([key, values]) => values.map((value) => {
      const label = props.label(key);
      const valueLabel = props.valueLabel?.(key, value) ?? value;
      return <button key={`${key}:${value}`} type="button"
        aria-label={props.removeLabel(label, valueLabel)}
        onClick={() => props.onRemove(key, value)}
        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 7px", border: `1px solid ${withAlpha(props.accent, 0.48)}`, borderRadius: 999, background: withAlpha(props.accent, 0.12), color: props.theme.text, cursor: "pointer", font: "inherit", fontSize: "var(--fs-tiny)", lineHeight: 1.35, fontWeight: 900 }}>
        <span style={{ color: props.accent }}>{label}</span> {valueLabel}
        <span aria-hidden style={{ color: props.theme.red, fontSize: 14, lineHeight: 1 }}>×</span>
      </button>;
    }))}
  </div>;
}
