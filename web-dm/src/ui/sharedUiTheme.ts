import { theme, withAlpha } from "@/theme/theme";

export const dmSharedButtonTheme = {
  radius: theme.radius.control,
  text: theme.colors.text,
  textDark: theme.colors.textDark,
  panelBorder: theme.colors.panelBorder,
  accentPrimary: theme.colors.accentPrimary,
  red: theme.colors.red,
  green: theme.colors.green,
  bloody: theme.colors.bloody,
};

export const dmSharedInputTheme = {
  radius: theme.radius.control,
  panelBorder: theme.colors.panelBorder,
  inputBg: theme.colors.inputBg,
  text: theme.colors.text,
};

export const dmSharedSelectTheme = {
  radius: theme.radius.control,
  panelBorder: theme.colors.panelBorder,
  inputBg: theme.colors.inputBg,
  bg: theme.colors.bg,
  text: theme.colors.text,
  textDark: theme.colors.textDark,
  accentHighlight: theme.colors.accentHighlight,
  withAlpha,
};

export const dmSharedPanelTheme = {
  borderColor: "rgba(255,255,255,0.09)",
  background: "rgba(255,255,255,0.035)",
  radius: theme.radius.panel,
  padding: "12px 14px",
  titleFontSize: "var(--fs-tiny)",
  titleFontWeight: 700,
} as const;
