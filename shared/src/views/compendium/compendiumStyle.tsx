import * as React from "react";
import { PALETTE, withAlpha } from "../../ui/colors";
import { Button as SharedButton } from "../../ui/Button";
import { IconButton as SharedIconButton } from "../../ui/IconButton";
import { Select as SharedSelect } from "../../ui/Select";

/**
 * The compendium's colours, the same in the DM and player apps.
 *
 * Text, muted text and panel background go through the DM workspace's colour variables, so a DM
 * who recolours a workspace panel sees the compendium follow it when it is shown there. Anywhere
 * those variables are not set (the player app, the standalone compendium page) the palette applies.
 */
export const COMPENDIUM_COLORS = {
  bg: PALETTE.bg,
  panelBg: `var(--dm-panel-background, ${PALETTE.panelBg})`,
  panelBorder: PALETTE.panelBorder,
  inputBg: "rgba(0,0,0,0.30)",
  text: `var(--dm-text, ${PALETTE.text})`,
  textDark: PALETTE.textDark,
  muted: `var(--dm-muted, ${PALETTE.muted})`,
  /** Gold accent. */
  accent: PALETTE.accentPrimary,
  /** Blue highlight: selection, active filters. */
  highlight: PALETTE.accentHighlight,
  red: PALETTE.red,
  green: PALETTE.green,
  colorMagic: PALETTE.colorMagic,
  colorGold: PALETTE.colorGold,
  colorPinkRed: PALETTE.colorPinkRed,
  shadow: "rgba(0,0,0,0.80)",
  /** Section headings inside a stat block. */
  sectionTitle: "var(--campaign-accent, #a78bfa)",
} as const;

const C = COMPENDIUM_COLORS;

/** Background of the selected row in every compendium list. */
export const ACTIVE_ROW_BACKGROUND = withAlpha(C.highlight, 0.18);

/** Every list row in the compendium is this tall, so the virtual lists can compute positions. */
export const COMPENDIUM_ROW_HEIGHT = 52;

const SELECT_THEME = {
  radius: 10,
  panelBorder: C.panelBorder,
  inputBg: C.inputBg,
  bg: C.bg,
  text: C.text,
  textDark: C.textDark,
  accentHighlight: C.highlight,
  withAlpha,
};

const BUTTON_THEME = {
  radius: 10,
  text: C.text,
  textDark: C.textDark,
  panelBorder: C.panelBorder,
  accentPrimary: C.accent,
  red: C.red,
  green: C.green,
};

export function CompendiumSelect(props: Omit<React.ComponentProps<typeof SharedSelect>, "theme">) {
  return <SharedSelect {...props} theme={SELECT_THEME} />;
}

export function CompendiumButton(props: Omit<React.ComponentProps<typeof SharedButton>, "theme">) {
  return <SharedButton {...props} theme={BUTTON_THEME} />;
}

export function CompendiumIconButton(
  props: Omit<React.ComponentProps<typeof SharedIconButton>, "borderColor" | "accentColor" | "textColor" | "textDarkColor">,
) {
  return (
    <SharedIconButton
      {...props}
      borderColor={C.panelBorder}
      accentColor={C.sectionTitle}
      textColor={C.text}
      textDarkColor={C.textDark}
      hoverBackground={withAlpha(C.panelBorder, 0.3)}
      ghostBackground={withAlpha(C.panelBorder, 0.12)}
    />
  );
}

/** The search box at the top of each browser. */
export const searchInputStyle: React.CSSProperties = {
  background: C.panelBg,
  color: C.text,
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 10,
  padding: "8px 10px",
  outline: "none",
};

/** A small bordered text input (used for CR bounds). */
export const smallInputStyle: React.CSSProperties = {
  background: C.inputBg,
  color: C.text,
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 10,
  padding: "7px 8px",
  fontSize: "var(--fs-subtitle)",
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

/** A neutral pill button (quick CR ranges, A-Z letters). */
export const plainPillStyle: React.CSSProperties = {
  border: `1px solid ${C.panelBorder}`,
  background: withAlpha(C.panelBorder, 0.3),
  color: C.text,
  padding: "3px 8px",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: "var(--fs-small)",
  fontWeight: 700,
};

/** The panel title of each browser: an icon and a name. */
export function BrowserTitle(props: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--fs-large)" }}>
      {props.icon}
      <span>{props.children}</span>
    </span>
  );
}

/** A coloured label chip (rarity, magic, attunement, category...). */
export function CompendiumTag({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        border: `1px solid ${color}33`,
        background: `${color}1a`,
        color,
        fontSize: "var(--fs-small)",
        fontWeight: 700,
      }}
    >
      {label}
    </span>
  );
}
