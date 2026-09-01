import { C } from "@/lib/theme";

/** Small grip button used both by placed panels (Slice 5 collapses them to
 * title cards while editing) and sidebar PanelCards. Only wires up
 * pointerdown -- move/up/cancel are handled globally by
 * `usePanelDragAndDrop`'s window listeners once a drag starts, so a panel can
 * move to a different column's DOM parent mid-drag without losing them. */
export function PanelDragHandle(props: {
  label: string;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <button
      type="button"
      title={`Drag ${props.label}`}
      aria-label={`Drag ${props.label}`}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onPointerDown={props.onPointerDown}
      style={{
        width: 24,
        height: 24,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 7,
        border: "1px solid rgba(255,255,255,0.16)",
        background: "rgba(10,15,28,0.92)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
        cursor: props.dragging ? "grabbing" : "grab",
        touchAction: "none",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span aria-hidden style={{ display: "grid", gridTemplateColumns: "repeat(2, 3px)", gridAutoRows: "3px", gap: 2 }}>
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} style={{ width: 3, height: 3, borderRadius: "50%", background: C.muted }} />
        ))}
      </span>
    </button>
  );
}
