import { PALETTE } from "@beholden/shared/ui/colors";

export { withAlpha } from "@beholden/shared/ui/colors";

// Mirrors web-dm's theme tokens (both source from shared PALETTE) so both UIs look identical.
export const C = {
  // ── Base surfaces ────────────────────────────────────────────────
  bg:          PALETTE.bg,
  panelBg:     PALETTE.panelBg,
  panelBorder: PALETTE.panelBorder,

  // ── Text ─────────────────────────────────────────────────────────
  text:        PALETTE.text,
  textDark:    PALETTE.textDark,
  muted:       PALETTE.muted,

  // ── Accent ───────────────────────────────────────────────────────
  accent:      PALETTE.accentPrimary,
  accentHl:    PALETTE.accentHighlight,

  // ── Semantic ─────────────────────────────────────────────────────
  red:         PALETTE.red,
  green:       PALETTE.green,

  // ── Domain palette (D&D item/spell types) ────────────────────────
  // Use these instead of inlining the same hex values across files.
  colorMagic:   PALETTE.colorMagic,   // magic items, spell slots, arcane
  colorRitual:  PALETTE.colorRitual,  // ritual spells, concentration, ranged
  colorGold:    PALETTE.colorGold,    // masteries, primary highlights, currency
  colorOrange:  PALETTE.colorOrange,  // tools, fire damage, orange category
  colorPinkRed: PALETTE.colorPinkRed, // damage taken, disadvantage, wounds
};

