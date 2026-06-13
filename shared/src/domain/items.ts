export const ITEM_RARITY_ORDER = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"] as const;

export const KNOWN_ITEM_TYPES = [
  "Light Armor", "Medium Armor", "Heavy Armor", "Shield",
  "Melee Weapon", "Ranged Weapon", "Ammunition",
  "Potion", "Scroll", "Wand", "Rod", "Staff", "Ring",
  "Wondrous Item", "Adventuring Gear", "Currency", "Other",
] as const;

const ITEM_DAMAGE_TYPE_LABELS: Record<string, string> = {
  B: "Bludgeoning",
  P: "Piercing",
  S: "Slashing",
  A: "Acid",
  C: "Cold",
  F: "Fire",
  FC: "Force",
  L: "Lightning",
  N: "Necrotic",
  PS: "Poison",
  PY: "Psychic",
  R: "Radiant",
  T: "Thunder",
};

const ITEM_PROPERTY_LABELS: Record<string, string> = {
  A: "Ammunition",
  AF: "Ammunition (Firearm)",
  BF: "Burst Fire",
  F: "Finesse",
  H: "Heavy",
  L: "Light",
  LD: "Loading",
  M: "Martial",
  R: "Reach",
  RC: "Reload",
  S: "Special",
  T: "Thrown",
  V: "Versatile",
  "2H": "Two-Handed",
};

export function uniqSorted(xs: string[]) {
  return Array.from(new Set(xs.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function sortedRarities(xs: string[]) {
  const set = new Set(xs.filter(Boolean));
  const ordered = ITEM_RARITY_ORDER.filter((r) => set.has(r));
  const extra = Array.from(set).filter((r) => !ITEM_RARITY_ORDER.includes(r as typeof ITEM_RARITY_ORDER[number])).sort();
  return [...ordered, ...extra];
}

export function normalizeInventoryItemLookupName(name: string): string {
  return String(name ?? "")
    .replace(/\s+\[(?:2024|5\.5e)\]\s*$/i, "")
    .replace(/\s+\((?:2024|5\.5e)\)\s*$/i, "")
    .trim()
    .toLowerCase();
}

export function formatItemDamageType(code: string | null | undefined): string | null {
  const key = String(code ?? "").trim().toUpperCase();
  if (!key) return null;
  return ITEM_DAMAGE_TYPE_LABELS[key] ?? key;
}

export function formatItemProperties(properties: string[] | null | undefined): string {
  return (properties ?? [])
    .map((code) => {
      const key = String(code ?? "").trim().toUpperCase();
      return ITEM_PROPERTY_LABELS[key] ?? key;
    })
    .filter(Boolean)
    .join(", ");
}

export function currencyCodeForName(name: string | null | undefined): "PP" | "GP" | "EP" | "SP" | "CP" | null {
  const normalized = String(name ?? "").trim().toUpperCase();
  if (normalized === "PP" || normalized === "GP" || normalized === "EP" || normalized === "SP" || normalized === "CP") return normalized;
  return null;
}

export function isCurrencyName(name: string | null | undefined): boolean {
  return currencyCodeForName(name) != null;
}
