// Mirrors web-dm's theme.ts so both UIs look identical
export const C = {
  // ── Base surfaces ────────────────────────────────────────────────
  bg:          "#0d1525",
  panelBg:     "rgba(255,255,255,0.055)",
  panelBorder: "rgba(255,255,255,0.13)",

  // ── Text ─────────────────────────────────────────────────────────
  text:        "#e8edf5",
  textDark:    "#0d1525",
  muted:       "rgba(160,180,220,0.75)",

  // ── Accent ───────────────────────────────────────────────────────
  accent:      "#f0a500",
  accentHl:    "#38b6ff",

  // ── Semantic ─────────────────────────────────────────────────────
  red:         "#ff5d5d",
  green:       "#5ecb6b",

  // ── Domain palette (D&D item/spell types) ────────────────────────
  // Use these instead of inlining the same hex values across files.
  colorMagic:   "#a78bfa",   // magic items, spell slots, arcane
  colorRitual:  "#60a5fa",   // ritual spells, concentration, ranged
  colorGold:    "#fbbf24",   // masteries, primary highlights, currency
  colorOrange:  "#fb923c",   // tools, fire damage, orange category
  colorPinkRed: "#f87171",   // damage taken, disadvantage, wounds
};

export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const c = (color || "").trim();
  const hex = c.startsWith("#") ? c.slice(1) : c;
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  const rgbaMatch = c.match(/^rgba\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*),(\s*[\d.]+\s*)\)$/i);
  if (rgbaMatch) return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${a})`;
  return c;
}
