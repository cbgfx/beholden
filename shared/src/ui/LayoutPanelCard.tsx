import type { ReactNode, PointerEvent } from "react";
import { IconPalette } from "../icons/PaletteIcon";
import { useUiTranslation } from "../i18n/useUiTranslation";
import { LAYOUT_COLORS as C } from "./layoutTheme";

import { PanelDragHandle } from "./PanelDragHandle";

/** A single panel's title-only card, used both for unplaced panels in the
 * edit-mode palette sidebar and for placed panels while editing (full panel
 * content only renders outside edit mode) -- small, uniform-height rows make
 * drag hit-testing reliable and dragging itself much easier to aim.
 *
 * While this card is the one being dragged, it renders as a dashed
 * placeholder (the floating ghost carries the visible title instead) --
 * mirrors the Trello-style "gap where it'll land" feel. */
export function PanelCard(props: {
  title: string;
  actions?: ReactNode;
  dragging: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
  onPointerDown: (e: PointerEvent) => void;
  onOpenColors: () => void;
}) {
  const translateUi = useUiTranslation("sharedUi");
  if (props.dragging) {
    return (
      <div
        ref={props.rowRef}
        style={{
          height: 40,
          borderRadius: 8,
          border: "1px dashed rgba(255,255,255,0.22)",
          background: "rgba(255,255,255,0.02)",
        }}
      />
    );
  }
  return (
    <div
      ref={props.rowRef}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 8,
        border: "1px dashed rgba(255,255,255,0.2)",
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <PanelDragHandle
        label={props.title}
        dragging={props.dragging}
        onPointerDown={props.onPointerDown}
      />
      <span
        style={{
          fontSize: "var(--fs-small)",
          fontWeight: 700,
          color: C.text,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {props.title}
      </span>
      {props.actions}
      <button
        type="button"
        aria-label={`${translateUi("Colours")}: ${props.title}`}
        title={translateUi("Panel colours")}
        onClick={props.onOpenColors}
        style={{
          width: 28,
          height: 28,
          flexShrink: 0,
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.16)",
          background: "rgba(255,255,255,0.05)",
          color: C.muted,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <IconPalette />
      </button>
    </div>
  );
}
