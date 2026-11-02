import { PALETTE } from "./colors";

/** Workspace overrides also work in Player, where the shared palette is the fallback. */
export const LAYOUT_COLORS = {
  text: `var(--dm-text, ${PALETTE.text})`,
  muted: "var(--dm-muted, #a0b4dc)",
  bg: "#0e1625",
  panelBorder: "rgba(255,255,255,.14)",
  red: PALETTE.red,
};
