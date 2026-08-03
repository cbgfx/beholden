import { Modal } from "@/components/overlay/Modal";
import { IconBinder, IconDownload } from "@/icons";
import { Button } from "@/ui/Button";
import { theme, withAlpha } from "@/theme/theme";

export function BinderExportModal(props: {
  isOpen: boolean;
  binderName: string;
  exporting: "json" | "zip" | null;
  error: string | null;
  onClose: () => void;
  onExport: (includePictures: boolean) => void;
}) {
  const busy = props.exporting !== null;
  return (
    <Modal isOpen={props.isOpen} onClose={busy ? () => undefined : props.onClose} title="Export Binder" width={520} height="auto">
      <div style={{ padding: 22, display: "grid", gap: 18 }}>
        <div style={{ display: "flex", gap: 13, alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: 13, display: "grid", placeItems: "center", color: theme.colors.accentHighlight, background: withAlpha(theme.colors.accentHighlight, 0.1), border: `1px solid ${withAlpha(theme.colors.accentHighlight, 0.35)}` }}>
            <IconBinder size={28} />
          </div>
          <div>
            <div style={{ color: theme.colors.text, fontWeight: 900, fontSize: "var(--fs-large)" }}>{props.binderName}</div>
            <div style={{ color: theme.colors.muted, marginTop: 3, lineHeight: 1.4 }}>Choose a lightweight data export or a portable archive containing portraits.</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <button type="button" disabled={busy} onClick={() => props.onExport(false)} style={choiceStyle(false, busy)}>
            <IconDownload size={22} />
            <strong>{props.exporting === "json" ? "Exporting..." : "Binder JSON"}</strong>
            <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", lineHeight: 1.4 }}>Lore and links only. Small and quick to transfer.</span>
          </button>
          <button type="button" disabled={busy} onClick={() => props.onExport(true)} style={choiceStyle(true, busy)}>
            <IconDownload size={22} />
            <strong>{props.exporting === "zip" ? "Bundling..." : "ZIP with pictures"}</strong>
            <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", lineHeight: 1.4 }}>Includes Mortal and Deity portraits for portable re-import.</span>
          </button>
        </div>

        {props.error ? <div role="alert" style={{ padding: "10px 12px", borderRadius: theme.radius.control, color: theme.colors.red, background: withAlpha(theme.colors.red, 0.1), border: `1px solid ${withAlpha(theme.colors.red, 0.35)}` }}>{props.error}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={props.onClose} disabled={busy}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

function choiceStyle(accent: boolean, disabled: boolean): React.CSSProperties {
  const color = accent ? theme.colors.accentHighlight : theme.colors.text;
  return {
    minHeight: 138,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
    textAlign: "left",
    color,
    background: withAlpha(color, accent ? 0.1 : 0.04),
    border: `1px solid ${withAlpha(color, accent ? 0.42 : 0.18)}`,
    borderRadius: theme.radius.control,
    cursor: disabled ? "wait" : "pointer",
    opacity: disabled ? 0.65 : 1,
    font: "inherit",
  };
}
