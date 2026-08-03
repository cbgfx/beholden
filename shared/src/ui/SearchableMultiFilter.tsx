import { useEffect, useState } from "react";
import { Input } from "./Input";

export type SearchableMultiFilterTheme = {
  radius: string | number;
  panelBorder: string;
  inputBg: string;
  text: string;
  muted: string;
  menuBg?: string;
};

export function SearchableMultiFilter(props: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onAdd: (value: string) => void;
  width?: number;
  theme: SearchableMultiFilterTheme;
}) {
  const display = `${props.label}: ${props.selected.length ? "Add…" : "All"}`;
  const [query, setQuery] = useState(display);
  const [open, setOpen] = useState(false);
  useEffect(() => setQuery(display), [display]);
  const needle = query === display ? "" : query.trim().toLocaleLowerCase();
  const filtered = props.options.filter((option) => !props.selected.includes(option.value) && option.label.toLocaleLowerCase().includes(needle)).slice(0, 20);

  return <div style={{ position: "relative", width: props.width ?? 165 }}>
    <Input theme={props.theme} value={query} aria-label={props.label} autoComplete="off"
      onFocus={(event) => { setOpen(true); event.currentTarget.select(); }}
      onClick={(event) => { setOpen(true); event.currentTarget.select(); }}
      onBlur={() => window.setTimeout(() => { setOpen(false); setQuery(display); }, 120)}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); }} />
    {open ? <div style={{ position: "absolute", zIndex: 220, top: "calc(100% + 4px)", left: 0, width: "max-content", minWidth: "100%", maxWidth: 300, maxHeight: 260, overflowY: "auto", padding: 4, border: `1px solid ${props.theme.panelBorder}`, borderRadius: props.theme.radius, background: props.theme.menuBg ?? "#0d1525", boxShadow: "0 12px 28px rgba(0,0,0,.65)" }}>
      {filtered.map((option) => <button key={option.value} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { props.onAdd(option.value); setOpen(false); }} style={{ display: "block", width: "100%", padding: "8px 10px", border: 0, borderRadius: 6, background: "transparent", color: props.theme.text, textAlign: "left", cursor: "pointer", font: "inherit", whiteSpace: "nowrap" }}>{option.label}</button>)}
      {!filtered.length ? <div style={{ padding: "8px 10px", color: props.theme.muted }}>No matches</div> : null}
    </div> : null}
  </div>;
}
