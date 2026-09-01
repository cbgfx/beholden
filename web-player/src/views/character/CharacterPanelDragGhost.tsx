import { C } from "@/lib/theme";
import { PANEL_TITLES, type PanelId } from "@/views/character/panelRegistry";

/** The floating card that follows the cursor while dragging -- the "lifted
 * card" feel Trello/dnd-kit-style drag has, which the in-place-only reflow
 * this hook started with was missing. Purely visual: `pointer-events: none`
 * so it never itself becomes a drop target. */
export function PanelDragGhost(props: { id: PanelId; x: number; y: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        left: props.x + 14,
        top: props.y + 10,
        zIndex: 1000,
        pointerEvents: "none",
        transform: "rotate(-2deg)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.22)",
        background: "rgba(18,24,40,0.97)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
        fontSize: "var(--fs-small)",
        fontWeight: 700,
        color: C.text,
        whiteSpace: "nowrap",
      }}
    >
      {PANEL_TITLES[props.id]}
    </div>
  );
}
