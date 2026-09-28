import React from "react";
import { MagicBadge as SharedMagicBadge, RarityDot as SharedRarityDot, StatCard, Tag, rarityColor } from "@beholden/shared/ui";
import { theme } from "@/theme/theme";

/** Rarity colour for the DM app: the shared rarity table with this app's muted text colour. */
export function rarityChipColor(rarity: string | null): string {
  return rarityColor(rarity, theme.colors.muted);
}

export function searchStyle(): React.CSSProperties {
  return {
    background: theme.colors.panelBg,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: 10,
    padding: "8px 12px",
    outline: "none",
    fontSize: "var(--fs-medium)",
    width: "100%",
    boxSizing: "border-box",
  };
}

export function MagicBadge() {
  return <SharedMagicBadge color={theme.colors.colorMagic} />;
}

export function RarityDot({ rarity }: { rarity: string | null }) {
  return <SharedRarityDot color={rarityChipColor(rarity)} />;
}

export function Chip({ label, color }: { label: string; color: string }) {
  return <Tag label={label} color={color} />;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <StatCard label={label} value={value} theme={{ borderColor: theme.colors.panelBorder, background: "rgba(255,255,255,0.035)", mutedColor: theme.colors.muted, textColor: theme.colors.text }} />;
}
