import type React from "react";

/**
 * Inline style for a small toggle-pill filter button.
 * Pass resolved color values from whichever theme system the caller uses.
 *
 * @param active       Whether the filter is currently active.
 * @param accentColor  The accent color (active state: border, background, text).
 * @param borderColor  The panel border color (inactive state border).
 * @param mutedColor   The muted text color (inactive state text).
 */
export function togglePillStyle(
  active: boolean,
  accentColor: string,
  borderColor: string,
  mutedColor: string,
): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? accentColor : borderColor}`,
    background: active ? `${accentColor}2e` : "rgba(255,255,255,0.05)",
    color: active ? accentColor : mutedColor,
    cursor: "pointer",
    fontSize: "var(--fs-pill, 11px)",
    fontWeight: 700,
  };
}
