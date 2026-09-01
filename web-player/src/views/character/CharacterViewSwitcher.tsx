import React from "react";
import ReactDOM from "react-dom";
import { C, withAlpha } from "@/lib/theme";
import type { SheetViewDef } from "@/views/character/panelRegistry";

/**
 * The sheet-view dropdown: lists every view (built-in Combat/Gear/Reference/
 * All plus any the player has created) with an "+ Add View" row at the
 * bottom. Bespoke rather than the shared `Select` component -- that one only
 * renders plain `<option>` rows, with no room for a differently-styled
 * footer action.
 */
export function CharacterViewSwitcher(props: {
  sheetViews: SheetViewDef[];
  activeViewId: string;
  accentColor: string;
  onSelectView: (id: string) => void;
  onCreateView: () => void;
}) {
  const { sheetViews, activeViewId, accentColor, onSelectView, onCreateView } = props;
  const activeView = sheetViews.find((view) => view.id === activeViewId) ?? sheetViews[0];
  const sortedViews = React.useMemo(
    () => [...sheetViews].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })),
    [sheetViews],
  );

  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const computeMenuPos = React.useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 180) });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    computeMenuPos();
    window.addEventListener("scroll", computeMenuPos, true);
    window.addEventListener("resize", computeMenuPos);
    return () => {
      window.removeEventListener("scroll", computeMenuPos, true);
      window.removeEventListener("resize", computeMenuPos);
    };
  }, [open, computeMenuPos]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = open ? (
    <div
      ref={menuRef}
      role="listbox"
      style={{
        position: "fixed",
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
        background: "rgba(10,15,28,0.98)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
        zIndex: 999999,
      }}
    >
      {sortedViews.map((view) => {
        const selected = view.id === activeViewId;
        return (
          <button
            key={view.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => { onSelectView(view.id); setOpen(false); }}
            style={{
              width: "100%",
              textAlign: "left",
              padding: "9px 12px",
              border: "none",
              background: selected ? withAlpha(accentColor, 0.18) : "transparent",
              color: selected ? accentColor : C.text,
              fontWeight: selected ? 800 : 650,
              fontSize: "var(--fs-small)",
              cursor: "pointer",
            }}
          >
            {view.name}
          </button>
        );
      })}
      <div style={{ height: 1, background: "rgba(255,255,255,0.1)" }} />
      <button
        type="button"
        onClick={() => { onCreateView(); setOpen(false); }}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "9px 12px",
          border: "none",
          background: "transparent",
          color: accentColor,
          fontWeight: 800,
          fontSize: "var(--fs-small)",
          cursor: "pointer",
        }}
      >
        + Add View
      </button>
    </div>
  ) : null;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 13px",
          borderRadius: 9,
          border: "1px solid rgba(255,255,255,0.09)",
          background: "rgba(255,255,255,0.04)",
          color: C.text,
          fontSize: "var(--fs-small)",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {activeView?.name ?? "View"}
        <span style={{ opacity: 0.7, fontWeight: 900 }}>▾</span>
      </button>
      {open ? ReactDOM.createPortal(menu, document.body) : null}
    </div>
  );
}
