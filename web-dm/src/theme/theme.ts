import { PALETTE } from "@beholden/shared/ui/colors";

export { withAlpha } from "@beholden/shared/ui/colors";

export const theme = {
  colors: {
    // ── Base surfaces ──────────────────────────────────────────────
    bg:          PALETTE.bg,
    panelBg:     PALETTE.panelBg,
    panelBorder: PALETTE.panelBorder,
    inputBg:     "rgba(0,0,0,0.30)",

    // ── Text ───────────────────────────────────────────────────────
    text:     PALETTE.text,
    textDark: PALETTE.textDark,
    muted:    PALETTE.muted,

    // ── Accent ─────────────────────────────────────────────────────
    accentPrimary:   PALETTE.accentPrimary,   // amber — warm, high contrast on dark blue
    accentWarning:   "#ff8c42",               // orange — distinct from amber

    // Highlight blue — more electric now that bg is much darker
    accentHighlight:       PALETTE.accentHighlight,
    accentHighlightBg:     "rgba(56,182,255,0.08)",
    accentHighlightBorder: "rgba(56,182,255,0.22)",

    // ── Overlay / chrome ───────────────────────────────────────────
    scrim:       "rgba(0,0,0,0.72)",
    shadowColor: "rgba(0,0,0,0.80)",
    drawerBg:    "rgba(13,21,37,0.97)",   // deep navy, nearly opaque
    modalBg:     "rgba(13,21,37,0.97)",

    // ── Semantic ───────────────────────────────────────────────────
    red:    PALETTE.red,
    bloody: "#ff8c42",
    green:  PALETTE.green,             // slightly punchier green — more visible on very dark bg
    blue:   PALETTE.accentHighlight,   // matches accentHighlight — player colour

    // ── Domain palette (D&D item/spell types) ──────────────────────
    // Use these instead of inlining the same hex values across files.
    colorMagic:   PALETTE.colorMagic,    // magic items, spell slots, arcane
    colorRitual:  PALETTE.colorRitual,   // ritual spells, concentration, ranged
    colorGold:    PALETTE.colorGold,     // masteries, primary highlights, currency
    colorOrange:  PALETTE.colorOrange,   // tools, fire damage, orange category
    colorPinkRed: PALETTE.colorPinkRed,  // damage taken, disadvantage, wounds
  },

  radius:  { panel: 14, control: 10 },
  spacing: { pagePad: 10, gap: 6 },
};

