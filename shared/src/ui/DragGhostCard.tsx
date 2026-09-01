import type React from "react";

/** The floating card that follows the cursor while dragging (notes,
 * inventory, character-sheet panels) -- the "lifted card" feel a plain
 * in-place reflow is missing. Purely visual: `pointer-events: none` so it
 * never becomes a drop target itself. Callers own the content; only the
 * positioning/box styling was ever actually identical between call sites. */
export function DragGhostCard(props: {
  x: number;
  y: number;
  borderColor?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
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
        maxWidth: 280,
        padding: "8px 14px",
        borderRadius: 8,
        border: `1px solid ${props.borderColor ?? "rgba(255,255,255,0.22)"}`,
        background: "rgba(18,24,40,0.97)",
        boxShadow: "0 12px 28px rgba(0,0,0,0.5)",
        ...props.style,
      }}
    >
      {props.children}
    </div>
  );
}
