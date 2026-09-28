
/**
 * Display colour for an item rarity. Common and unknown rarities use the caller's muted text
 * colour, because each app supplies that colour from its own theme.
 */
export function rarityColor(rarity: string | null | undefined, mutedColor: string): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "uncommon": return "#1eff00";
    case "rare": return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact": return "#e6cc80";
    default: return mutedColor;
  }
}

export function RarityDot({
  color,
  size = 7,
}: {
  color: string;
  size?: number;
}) {
  return <span style={{ width: size, height: size, borderRadius: "50%", background: color, display: "inline-block", flexShrink: 0 }} />;
}
