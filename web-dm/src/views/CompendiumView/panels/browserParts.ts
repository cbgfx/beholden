import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { IconPlus } from "@/icons";

/** Inline style for edit/delete action icon buttons in browser panel rows. */
export function actionBtnStyle(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 26, height: 26, padding: 0,
    border: `1px solid ${withAlpha(color, 0.3)}`,
    borderRadius: 6, background: withAlpha(color, 0.1),
    color, cursor: "pointer", fontSize: "var(--fs-small)", fontWeight: 700,
  };
}

/** Inline style for toggle-pill filter buttons. Pass `gold = true` for gold accent. */
export function togglePillStyle(active: boolean, gold = false): React.CSSProperties {
  const accent = gold ? theme.colors.accentPrimary : theme.colors.accentHighlight;
  return {
    padding: "4px 10px", borderRadius: 999,
    border: `1px solid ${active ? accent : theme.colors.panelBorder}`,
    background: active ? withAlpha(accent, 0.18) : withAlpha(theme.colors.shadowColor, 0.12),
    color: active ? accent : theme.colors.muted,
    cursor: "pointer", fontSize: "var(--fs-pill, 11px)", fontWeight: 700,
  };
}

/** Small + button used in the panel header actions area to open a create form. */
export function BrowserAddButton(props: { title: string; onClick: () => void }) {
  return React.createElement("button", {
    type: "button",
    title: props.title,
    onClick: props.onClick,
    style: {
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 28, height: 28, borderRadius: 8,
      border: `1px solid ${theme.colors.panelBorder}`,
      background: theme.colors.accentPrimary,
      color: theme.colors.textDark,
      cursor: "pointer",
    },
  }, React.createElement(IconPlus, { size: 14 }));
}
