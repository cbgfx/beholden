export const ITEM_RARITY_ORDER = ["common", "uncommon", "rare", "very rare", "legendary", "artifact"] as const;

export const KNOWN_ITEM_TYPES = [
  "Light Armor", "Medium Armor", "Heavy Armor", "Shield",
  "Melee Weapon", "Ranged Weapon", "Ammunition",
  "Potion", "Scroll", "Wand", "Rod", "Staff", "Ring",
  "Wondrous Item", "Adventuring Gear", "Currency", "Other",
] as const;

/** Item detail presentation returned by the shared compendium API. */
export type CompendiumItemDetail = {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  attunement: boolean;
  magic: boolean;
  weight: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1: string | null;
  dmg2: string | null;
  dmgType: string | null;
  properties: string[];
  modifiers: Array<{ target?: string; amount?: number }>;
  text: string | string[];
};

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

/** An item's passive numeric bonus, stored as a cold fact: the statistic it applies to and
 * the signed amount. Ability-score changes are `effects` (`ability_score`), never modifiers. */
export type ItemModifierTarget =
  | "ac"
  | "melee_attacks"
  | "melee_damage"
  | "ranged_attacks"
  | "ranged_damage"
  | "weapon_attacks"
  | "weapon_damage"
  | "saving_throws"
  | "ability_checks"
  | "spell_attack"
  | "spell_save_dc"
  | "initiative"
  | "proficiency_bonus";

export interface ItemModifierEntry {
  target?: ItemModifierTarget | string | null;
  amount?: number | null;
}

const ITEM_MODIFIER_LABELS: Record<ItemModifierTarget, string> = {
  ac: "AC",
  melee_attacks: "Melee attacks",
  melee_damage: "Melee damage",
  ranged_attacks: "Ranged attacks",
  ranged_damage: "Ranged damage",
  weapon_attacks: "Weapon attacks",
  weapon_damage: "Weapon damage",
  saving_throws: "Saving throws",
  ability_checks: "Ability checks",
  spell_attack: "Spell attacks",
  spell_save_dc: "Spell save DC",
  initiative: "Initiative",
  proficiency_bonus: "Proficiency Bonus",
};

/** Sums an item's typed `modifiers` for one target. No label parsing — the compendium stores
 * `{ target, amount }` facts and every consumer (AC, weapon attack/damage, saves, checks)
 * reads them through this single accessor. */
export function itemModifierBonus(
  modifiers: readonly ItemModifierEntry[] | null | undefined,
  target: ItemModifierTarget,
): number {
  let total = 0;
  for (const modifier of modifiers ?? []) {
    if (modifier?.target === target && Number.isFinite(Number(modifier.amount))) {
      total += Number(modifier.amount);
    }
  }
  return total;
}

/** Display label for a typed item modifier, e.g. "Melee attacks +1". */
export function itemModifierLabel(modifier: ItemModifierEntry): string | null {
  const target = String(modifier?.target ?? "") as ItemModifierTarget;
  const amount = Number(modifier?.amount);
  const label = ITEM_MODIFIER_LABELS[target];
  if (!label || !Number.isFinite(amount) || amount === 0) return null;
  return `${label} ${amount > 0 ? "+" : ""}${amount}`;
}
