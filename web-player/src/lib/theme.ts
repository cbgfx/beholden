import { PALETTE } from "@beholden/shared/ui/colors";

export { withAlpha } from "@beholden/shared/ui/colors";

// Mirrors web-dm's theme tokens (both source from shared PALETTE) so both UIs look identical.
export const C = {
  // ── Base surfaces ────────────────────────────────────────────────
  bg:          PALETTE.bg,
  panelBg:     PALETTE.panelBg,
  panelBorder: PALETTE.panelBorder,

  // ── Text ─────────────────────────────────────────────────────────
  // A CSS var, not a literal hex: the character sheet's Theme drawer sets
  // --character-text-color on its root, so every existing `C.text` usage
  // picks up a per-character override for free. Falls back to the palette
  // default anywhere that variable isn't set (every other page in the app).
  text:        `var(--character-text-color, ${PALETTE.text})`,
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

