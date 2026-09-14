import { useUiTranslation } from "@beholden/shared/i18n/useUiTranslation";
import { C } from "@/lib/theme";
import { PANEL_TITLES, type PanelId } from "@/views/character/layout/panelRegistry";
import { PanelDragHandle } from "@/views/character/layout/CharacterPanelDragHandle";

function IconPalette({ size = 16 }: { size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3a2 2 0 0 1 2-2h1.8A5.2 5.2 0 0 0 22 10.2C22 5.7 17.5 2 12 2Z" /></svg>;
}

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
  onOpenColors: () => void;
}) {
  const translateUi = useUiTranslation("playerUi");
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
        label={translateUi(PANEL_TITLES[props.id])}
        dragging={props.dragging}
        onPointerDown={props.onPointerDown}
      />
      <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: C.text, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {translateUi(PANEL_TITLES[props.id])}
      </span>
      <button type="button" aria-label={`${translateUi("Colours")}: ${translateUi(PANEL_TITLES[props.id])}`} title={translateUi("Panel colours")} onClick={props.onOpenColors} style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 6, border: "1px solid rgba(255,255,255,0.16)", background: "rgba(255,255,255,0.05)", color: C.muted, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <IconPalette />
      </button>
    </div>
  );
}
