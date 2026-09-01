import { C } from "@/lib/theme";
import { PANEL_TITLES, type PanelId } from "@/views/character/panelRegistry";
import { PanelDragHandle } from "@/views/character/CharacterPanelDragHandle";

/** A single panel's title-only card, used both for unplaced panels in the
 * edit-mode palette sidebar and for placed panels while editing (full panel
 * content only renders outside edit mode) -- small, uniform-height rows make
 * drag hit-testing reliable and dragging itself much easier to aim.
 *
 * While this card is the one being dragged, it renders as a dashed
 * placeholder (the floating ghost carries the visible title instead) --
 * mirrors the Trello-style "gap where it'll land" feel. */
export function PanelCard(props: {
  id: PanelId;
  dragging: boolean;
  rowRef: (el: HTMLDivElement | null) => void;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
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
        label={PANEL_TITLES[props.id]}
        dragging={props.dragging}
        onPointerDown={props.onPointerDown}
      />
      <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {PANEL_TITLES[props.id]}
      </span>
    </div>
  );
}
