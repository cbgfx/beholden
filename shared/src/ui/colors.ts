// Canonical color values shared by web-dm's `theme.colors` and web-player's `C`.
// Both apps re-export these under their own key names/extras — edit values here, not in either app.
export const PALETTE: Record<
  | "bg" | "panelBg" | "panelBorder" | "text" | "textDark" | "muted"
  | "accentPrimary" | "accentHighlight" | "red" | "green"
  | "colorMagic" | "colorRitual" | "colorGold" | "colorOrange" | "colorPinkRed",
  string
> = {
  bg: "#0d1525",
  panelBg: "rgba(255,255,255,0.055)",
  panelBorder: "rgba(255,255,255,0.13)",
  text: "#e8edf5",
  textDark: "#0d1525",
  muted: "rgba(160,180,220,0.75)",
  accentPrimary: "#f0a500",
  accentHighlight: "#38b6ff",
  red: "#ff5d5d",
  green: "#5ecb6b",
  colorMagic: "#a78bfa",
  colorRitual: "#60a5fa",
  colorGold: "#fbbf24",
  colorOrange: "#fb923c",
  colorPinkRed: "#f87171",
};

export function withAlpha(color: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha));
  const value = (color || "").trim();

  const rgba = value.match(/^rgba\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*),(\s*[\d.]+\s*)\)$/i);
  if (rgba) return `rgba(${rgba[1]},${rgba[2]},${rgba[3]},${a})`;

  const rgb = value.match(/^rgb\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*)\)$/i);
  if (rgb) return `rgba(${rgb[1]},${rgb[2]},${rgb[3]},${a})`;

  const hex = value.startsWith("#") ? value.slice(1) : value;
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return `rgba(${parseInt(hex[0] + hex[0], 16)},${parseInt(hex[1] + hex[1], 16)},${parseInt(hex[2] + hex[2], 16)},${a})`;
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${a})`;
  }

  return `color-mix(in srgb, ${value} ${Math.round(a * 100)}%, transparent)`;
}
