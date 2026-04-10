import React from "react";
import { theme } from "@/theme/theme";

export function CharacterSheetDetailsPanel({
  infoLines,
  compact,
}: {
  infoLines?: Array<{ label: string; value: string }>;
  compact: boolean;
}) {
  const info = (infoLines ?? []).filter((line) => line.value?.trim() && line.value.trim() !== "--");
  const [open, setOpen] = React.useState(true);

  if (info.length === 0) return null;

  return (
    <div
      style={{
        border: `1px solid ${theme.colors.panelBorder}`,
        borderRadius: 12,
        background: theme.colors.panelBg,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: compact ? "7px 10px" : "8px 12px",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          color: theme.colors.text,
          fontSize: "var(--fs-small)",
          fontWeight: 900,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        <span>Details</span>
        <span style={{ color: theme.colors.muted }}>{open ? "^" : "v"}</span>
      </button>

      {open && (
        <div style={{ padding: compact ? "0 10px 8px" : "0 12px 10px", display: "grid", gap: 4 }}>
          {info.map((line) => (
            <div key={line.label} style={{ display: "flex", gap: 6, fontSize: "var(--fs-small)", lineHeight: 1.4 }}>
              <span style={{ color: theme.colors.muted, fontWeight: 700, whiteSpace: "nowrap" }}>{line.label}</span>
              <span style={{ color: theme.colors.text }}>{line.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
