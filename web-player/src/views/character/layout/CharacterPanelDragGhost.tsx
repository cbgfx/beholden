import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { DragGhostCard } from "@beholden/shared/ui";
import { C } from "@/lib/theme";
import { PANEL_TITLES, type PanelId } from "@/views/character/layout/panelRegistry";

/** The floating card that follows the cursor while dragging -- the "lifted
 * card" feel Trello/dnd-kit-style drag has, which the in-place-only reflow
 * this hook started with was missing. Purely visual: `pointer-events: none`
 * so it never itself becomes a drop target. */
export function PanelDragGhost(props: { id: PanelId; x: number; y: number }) {
  const translateUi = useUiTranslation("playerUi");
  return (
    <DragGhostCard
      x={props.x}
      y={props.y}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontSize: "var(--fs-small)",
        fontWeight: 700,
        color: C.text,
        whiteSpace: "nowrap",
      }}
    >
      {translateUi(PANEL_TITLES[props.id])}
    </DragGhostCard>
  );
}
