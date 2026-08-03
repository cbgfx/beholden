import React from "react";
import { Button } from "@/ui/Button";
import { IconBinder, IconDownload, IconPencil, IconTrash } from "@/icons";
import { theme, withAlpha } from "@/theme/theme";
import { exportBinder, type BinderSummary } from "@/services/binderApi";
import { BinderExportModal } from "./BinderExportModal";

type Props = {
  binder: BinderSummary;
  canEdit: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

const iconButton: React.CSSProperties = {
  width: 38,
  height: 38,
  flexShrink: 0,
  borderRadius: 9,
  border: `1px solid ${theme.colors.panelBorder}`,
  background: "rgba(255,255,255,0.07)",
  color: theme.colors.text,
  display: "inline-grid",
  placeItems: "center",
  cursor: "pointer",
};

function localDateStamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function BinderCard({ binder, canEdit, onOpen, onEdit, onDelete }: Props) {
  const accent = binder.color || theme.colors.accentHighlight;
  const [exportOpen, setExportOpen] = React.useState(false);
  const [exporting, setExporting] = React.useState<"json" | "zip" | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);

  async function handleExport(includePictures: boolean) {
    setExporting(includePictures ? "zip" : "json");
    setExportError(null);
    try {
      const blob = await exportBinder(binder.id, includePictures);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${binder.name || binder.id}-${localDateStamp()}.binder.${includePictures ? "zip" : "json"}`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setExportOpen(false);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Unable to export Binder.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <article
      style={{
        minHeight: 154,
        background: theme.colors.panelBg,
        border: `1px solid ${withAlpha(accent, 0.32)}`,
        borderRadius: theme.radius.panel,
        boxShadow: "0 4px 28px rgba(0,0,0,0.4)",
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "1fr auto",
      }}
    >
      <div style={{ padding: "14px 16px 10px", display: "grid", gap: 9 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", minWidth: 0 }}>
          <div
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              color: accent,
              border: `1px solid ${withAlpha(accent, 0.35)}`,
              background: withAlpha(accent, 0.1),
            }}
          >
            <IconBinder size={29} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: theme.colors.text,
                fontWeight: 850,
                fontSize: "var(--fs-title)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {binder.name}
            </div>
            <div style={{ color: theme.colors.muted, marginTop: 2, fontSize: "var(--fs-subtitle)" }}>
              {binder.currentDate.text ? `Current date: ${binder.currentDate.text}` : "No current date set"}
            </div>
          </div>
        </div>

        {binder.description ? (
          <div
            style={{
              color: theme.colors.muted,
              fontSize: "var(--fs-medium)",
              lineHeight: 1.35,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
            }}
          >
            {binder.description}
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 16, color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
          <span>{binder.campaignCount} {binder.campaignCount === 1 ? "Campaign" : "Campaigns"}</span>
          <span>{binder.recordCount} {binder.recordCount === 1 ? "Record" : "Records"}</span>
        </div>
      </div>

      <div style={{ padding: "0 10px 10px", display: "flex", alignItems: "center", gap: 8 }}>
        <Button onClick={onOpen} title="Open Binder" style={{ flex: 1, minWidth: 0 }}>
          Open
        </Button>
        <button type="button" onClick={() => { setExportError(null); setExportOpen(true); }} style={iconButton} title="Export Binder" aria-label="Export Binder">
          <IconDownload size={17} />
        </button>
        {canEdit ? (
          <>
            <button type="button" onClick={onEdit} style={iconButton} title="Edit Binder" aria-label="Edit Binder">
              <IconPencil size={16} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              style={{
                ...iconButton,
                color: theme.colors.red,
                background: "rgba(255,93,93,0.1)",
                borderColor: "rgba(255,93,93,0.35)",
              }}
              title="Delete Binder"
              aria-label="Delete Binder"
            >
              <IconTrash size={16} />
            </button>
          </>
        ) : null}
      </div>
      <BinderExportModal
        isOpen={exportOpen}
        binderName={binder.name}
        exporting={exporting}
        error={exportError}
        onClose={() => setExportOpen(false)}
        onExport={(includePictures) => void handleExport(includePictures)}
      />
    </article>
  );
}
