import * as React from "react";
import { theme, withAlpha } from "@/theme/theme";

export function SpellChoiceMenu({ value, options, onChange, ariaLabel }: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const root = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  const selected = options.find((option) => option.value === value)?.label ?? "Select";
  return <div ref={root} style={{ position: "relative" }}>
    <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} style={{ width: "100%", height: 38, padding: "0 11px", border: `1px solid ${open ? theme.colors.accentHighlightBorder : theme.colors.panelBorder}`, borderRadius: 9, background: theme.colors.inputBg, color: theme.colors.text, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, cursor: "pointer", font: "inherit", fontWeight: 700 }}><span>{selected}</span><span aria-hidden="true" style={{ color: theme.colors.muted, fontSize: 10, transform: open ? "rotate(180deg)" : undefined }}>▼</span></button>
    {open ? <div role="listbox" aria-label={ariaLabel} style={{ position: "absolute", zIndex: 30, top: "calc(100% + 5px)", left: 0, minWidth: "100%", width: "max-content", maxWidth: 280, maxHeight: 280, overflowY: "auto", padding: 5, border: "1px solid rgba(90,150,210,0.28)", borderRadius: 10, background: "#101a2b", boxShadow: "0 16px 40px rgba(0,0,0,.55)" }}>{options.map((option) => { const active = option.value === value; return <button key={option.value || "empty"} type="button" role="option" aria-selected={active} onClick={() => { onChange(option.value); setOpen(false); }} style={{ display: "block", width: "100%", border: 0, borderRadius: 7, padding: "8px 10px", background: active ? theme.colors.accentHighlightBg : "transparent", color: active ? theme.colors.accentHighlight : theme.colors.text, textAlign: "left", cursor: "pointer", font: "inherit", fontWeight: active ? 750 : 550, whiteSpace: "nowrap" }} onMouseEnter={(event) => { if (!active) event.currentTarget.style.background = withAlpha(theme.colors.accentHighlight, .06); }} onMouseLeave={(event) => { if (!active) event.currentTarget.style.background = "transparent"; }}>{option.label}</button>; })}</div> : null}
  </div>;
}
