import { C, withAlpha } from "@/lib/theme";

export const playerSharedButtonTheme = {
  radius: 10,
  text: C.text,
  textDark: C.textDark,
  panelBorder: C.panelBorder,
  accentPrimary: C.accent,
  red: C.red,
  green: C.green,
  bloody: "#ff8c42",
};

export const playerSharedSelectTheme = {
  radius: 10,
  panelBorder: C.panelBorder,
  inputBg: "rgba(0,0,0,0.30)",
  bg: C.bg,
  text: C.text,
  textDark: C.textDark,
  accentHighlight: C.accentHl,
  withAlpha,
};

export const playerSharedPanelTheme = {
  titleColor: C.text,
  borderColor: C.panelBorder,
  background: C.panelBg,
  radius: 14,
  padding: "8px 10px",
  titleFontSize: "var(--fs-body)",
  titleFontWeight: 900,
} as const;
