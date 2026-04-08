import React from "react";
import { ITEM_RARITY_ORDER, KNOWN_ITEM_TYPES, sortedRarities as sharedSortedRarities, uniqSorted as sharedUniqSorted } from "@beholden/shared/domain";
import { CheckRow as SharedCheckRow, FormField as SharedFormField, MagicBadge as SharedMagicBadge, RarityDot as SharedRarityDot, StatCard, Tag } from "@beholden/shared/ui";
import { theme } from "@/theme/theme";

export const RARITY_ORDER = [...ITEM_RARITY_ORDER];
export const KNOWN_TYPES = [...KNOWN_ITEM_TYPES];

export function uniqSorted(xs: string[]) {
  return sharedUniqSorted(xs);
}

export function sortedRarities(xs: string[]) {
  return sharedSortedRarities(xs);
}

export function rarityChipColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common": return theme.colors.muted;
    case "uncommon": return "#1eff00";
    case "rare": return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact": return "#e6cc80";
    default: return theme.colors.muted;
  }
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

export function fieldInput(): React.CSSProperties {
  return {
    background: theme.colors.panelBg,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: 8,
    padding: "7px 10px",
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

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <SharedFormField label={label} labelStyle={{ fontSize: "var(--fs-small)", fontWeight: 700, color: theme.colors.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </SharedFormField>
  );
}

export function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <SharedCheckRow label={label} checked={checked} onChange={onChange} style={{ fontSize: "var(--fs-subtitle)", color: theme.colors.text }} />;
}

export function Chip({ label, color }: { label: string; color: string }) {
  return <Tag label={label} color={color} />;
}

export function Stat({ label, value }: { label: string; value: string }) {
  return <StatCard label={label} value={value} theme={{ borderColor: theme.colors.panelBorder, background: "rgba(255,255,255,0.035)", mutedColor: theme.colors.muted, textColor: theme.colors.text }} />;
}
