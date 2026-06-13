import React from "react";
import { theme } from "@/theme/theme";
import { SectionTitle } from "@/ui/SectionTitle";

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
      <div style={{ padding: compact ? "7px 10px" : "8px 12px" }}>
        <SectionTitle
          collapsed={!open}
          onToggle={() => setOpen((value) => !value)}
          style={{ width: "100%", marginBottom: 0 }}
        >
          Details
        </SectionTitle>
      </div>

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
