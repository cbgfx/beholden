import type React from "react";
import { theme, withAlpha } from "@/theme/theme";

export function chipButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    height: 34,
    padding: "0 10px",
    borderRadius: 999,
    border: `1px solid ${active ? withAlpha(theme.colors.accentPrimary, 0.7) : theme.colors.panelBorder}`,
    background: active ? withAlpha(theme.colors.accentPrimary, 0.16) : "rgba(255,255,255,0.03)",
    color: active ? theme.colors.text : theme.colors.muted,
    cursor: "pointer",
    fontSize: "var(--fs-small)",
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}
