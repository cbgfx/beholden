import type { PointerEvent } from "react";
import { useUiTranslation } from "../i18n/useUiTranslation";
import { DragHandleGrip } from "./DragHandleGrip";
import { LAYOUT_COLORS as C } from "./layoutTheme";

/** The owning editor handles move/up/cancel globally so dragging survives
 * a panel moving between column DOM parents. */
export function PanelDragHandle(props: {
  label: string;
  dragging: boolean;
  onPointerDown: (e: PointerEvent) => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  return (
    <button
      type="button"
      title={translateUi("Drag {{value1}}", { value1: props.label })}
      aria-label={translateUi("Drag {{value1}}", { value1: props.label })}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
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
      <DragHandleGrip color={C.muted} />
    </button>
  );
}
