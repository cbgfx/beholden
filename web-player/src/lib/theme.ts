// Matches web-player/src/styles/index.css CSS variables
export const C = {
  bg:          "#0d1525",
  panelBg:     "#111c30",
  panelBorder: "#1e2d45",
  text:        "#c8d8f0",
  muted:       "#607090",
  accent:      "#e8a020",
  accentHl:    "#4ab3f4",
  red:         "#e05050",
  green:       "#4caf78",
  textDark:    "#0d1525",
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
