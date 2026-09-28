import type React from "react";
import { theme } from "@/theme/theme";
import { togglePillStyle as sharedTogglePillStyle } from "@beholden/shared/ui";

/** Inline style for toggle-pill buttons in the DM's compendium editors. Pass `gold = true` for the gold accent. */
export function togglePillStyle(active: boolean, gold = false): React.CSSProperties {
  const accent = gold ? theme.colors.accentPrimary : theme.colors.accentHighlight;
  return sharedTogglePillStyle(active, accent, theme.colors.panelBorder, theme.colors.muted);
}
