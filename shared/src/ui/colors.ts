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
