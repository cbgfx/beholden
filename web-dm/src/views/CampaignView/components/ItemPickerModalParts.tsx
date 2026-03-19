import React from "react";
import { theme } from "@/theme/theme";

export const RARITY_ORDER = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"];

export const KNOWN_TYPES = [
  "Light Armor", "Medium Armor", "Heavy Armor", "Shield",
  "Melee Weapon", "Ranged Weapon", "Ammunition",
  "Potion", "Scroll", "Wand", "Rod", "Staff", "Ring",
  "Wondrous Item", "Adventuring Gear", "Currency",
];

export function uniqSorted(xs: string[]) {
  return Array.from(new Set(xs.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function sortedRarities(xs: string[]) {
  const set = new Set(xs.filter(Boolean));
  const ordered = RARITY_ORDER.filter((r) => set.has(r));
  const extra = Array.from(set).filter((r) => !RARITY_ORDER.includes(r)).sort();
  return [...ordered, ...extra];
}

export function rarityChipColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common":    return theme.colors.muted;
    case "uncommon":  return "#1eff00";
    case "rare":      return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact":  return "#e6cc80";
    default:          return theme.colors.muted;
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
    fontSize: 14,
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
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  };
}

export function MagicBadge() {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 11, fontWeight: 700,
      color: "#a78bfa",
      border: "1px solid #6d28d966",
      borderRadius: 6, padding: "1px 6px",
      lineHeight: 1.4, whiteSpace: "nowrap",
    }}>
      ✦ Magic
    </span>
  );
}

export function RarityDot({ rarity }: { rarity: string | null }) {
  const colors: Record<string, string> = {
    common: theme.colors.muted,
    uncommon: "#1eff00",
    rare: "#0070dd",
    "very rare": "#a335ee",
    legendary: "#ff8000",
    artifact: "#e6cc80",
  };
  const c = colors[(rarity ?? "").toLowerCase()] ?? theme.colors.muted;
  return <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, display: "inline-block", flexShrink: 0 }} />;
}

export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: theme.colors.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      {children}
    </label>
  );
}

export function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: theme.colors.text }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 15, height: 15 }} />
      {label}
    </label>
  );
}

export function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
      border: `1px solid ${color}44`, background: `${color}1a`, color,
    }}>{label}</span>
  );
}
