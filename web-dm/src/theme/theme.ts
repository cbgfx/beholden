// theme.ts

export const theme = {
  colors: {
    // ── Base surfaces ──────────────────────────────────────────────
    bg:          "#0d1525",              // dark navy — dark but panels still pop
    panelBg:     "rgba(255,255,255,0.055)", // visible card lift
    panelBorder: "rgba(255,255,255,0.13)",  // crisp enough to define cards
    inputBg:     "rgba(0,0,0,0.30)",

    // ── Text ───────────────────────────────────────────────────────
    text:     "#e8edf5",                  // warm white — softer than pure #fff
    textDark: "#0d1525",                  // for text on amber/coloured backgrounds
    muted:           "rgba(160,180,220,0.75)", // blue-tinted muted — cohesive

    // ── Accent ─────────────────────────────────────────────────────
    accentPrimary:   "#f0a500",   // amber — warm, high contrast on dark blue
    accentWarning:   "#ff8c42",   // orange — distinct from amber

    // Highlight blue — more electric now that bg is much darker
    accentHighlight:       "#38b6ff",
    accentHighlightBg:     "rgba(56,182,255,0.08)",
    accentHighlightBorder: "rgba(56,182,255,0.22)",

    // ── Overlay / chrome ───────────────────────────────────────────
    scrim:       "rgba(0,0,0,0.72)",
    shadowColor: "rgba(0,0,0,0.80)",
    drawerBg:    "rgba(13,21,37,0.97)",   // deep navy, nearly opaque
    modalBg:     "rgba(13,21,37,0.97)",

    // ── Semantic ───────────────────────────────────────────────────
    red:    "#ff5d5d",
    bloody: "#ff8c42",
    green:  "#5ecb6b",   // slightly punchier green — more visible on very dark bg
    blue:   "#38b6ff",   // matches accentHighlight — player colour

    // ── Domain palette (D&D item/spell types) ──────────────────────
    // Use these instead of inlining the same hex values across files.
    colorMagic:   "#a78bfa",   // magic items, spell slots, arcane
    colorRitual:  "#60a5fa",   // ritual spells, concentration, ranged
    colorGold:    "#fbbf24",   // masteries, primary highlights, currency
    colorOrange:  "#fb923c",   // tools, fire damage, orange category
    colorPinkRed: "#f87171",   // damage taken, disadvantage, wounds
  },

  radius:  { panel: 14, control: 10 },
  spacing: { pagePad: 10, gap: 6 },
};

// Utility for creating translucent UI colors from theme tokens.
export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const c = (color || "").trim();

  const rgbaMatch = c.match(/^rgba\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*),(\s*[\d.]+\s*)\)$/i);
  if (rgbaMatch) return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${a})`;

  const rgbMatch = c.match(/^rgb\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*)\)$/i);
  if (rgbMatch) return `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${a})`;

  const hex = c.startsWith("#") ? c.slice(1) : c;
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  return c;
}
