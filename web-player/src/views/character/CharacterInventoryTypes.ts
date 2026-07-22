import type { CharacterData, ProficiencyMap, TaggedItem } from "@/views/character/CharacterSheetTypes";

export type TaggedItemLike = TaggedItem;
export type ProficiencyMapLike = Pick<ProficiencyMap, "weapons" | "armor">;
export type CharacterDataLike = Pick<CharacterData, "proficiencies" | "inventoryContainers">;

export interface CharacterLike {
  strScore: number | null;
  dexScore: number | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  equipped: boolean;
  proficiency?: string | null;
  equipState?: "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand" | "worn";
  containerId?: string | null;
  notes?: string;
  source?: "compendium" | "custom";
  itemId?: string;
  rarity?: string | null;
  type?: string | null;
  attunement?: boolean;
  attuned?: boolean;
  magic?: boolean;
  silvered?: boolean;
  equippable?: boolean;
  weight?: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  mastery?: string | null;
  modifiers?: Array<{ target?: string; amount?: number }>;
  description?: string;
  uses?: ItemUses | null;
  spells?: ItemSpells | null;
  spellcasting?: ItemSpellcasting | null;
  spellTemplate?: ItemSpellTemplates | null;
  ammo?: AmmoFamily | null;
  weaponAmmo?: AmmoFamily | null;
  usage?: "held" | null;
  chargesMax?: number | null;
  charges?: number | null;
  linkedAmmoId?: string | null;
  effects?: unknown[] | null;
}

export interface InventoryContainer {
  id: string;
  name: string;
  ignoreWeight?: boolean;
}

export interface InventoryPickerPayload {
  source: "compendium" | "custom";
  name: string;
  quantity: number;
  itemId?: string;
  rarity?: string | null;
  type?: string | null;
  attunement?: boolean;
  attuned?: boolean;
  magic?: boolean;
  silvered?: boolean;
  equippable?: boolean;
  weight?: number | null;
  value?: number | null;
  proficiency?: string | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  mastery?: string | null;
  modifiers?: Array<{ target?: string; amount?: number }>;
  description?: string;
  uses?: ItemUses | null;
  spells?: ItemSpells | null;
  spellcasting?: ItemSpellcasting | null;
  spellTemplate?: ItemSpellTemplates | null;
  ammo?: AmmoFamily | null;
  weaponAmmo?: AmmoFamily | null;
  usage?: "held" | null;
  bundle?: ItemBundle | null;
  container?: boolean;
  ignoreWeight?: boolean;
  effects?: unknown[] | null;
}

interface ItemBundle {
  container: string;
  items: Record<string, number>;
}

export type ItemUseAmount = number | string;
export type ItemUses = ItemUseAmount | {
  max: ItemUseAmount;
  recover?: false | ItemUseAmount;
};
type ItemSpellAccess = number | "level" | {
  cost?: number | "level";
  level?: number;
  uses?: ItemUseAmount;
  consume?: true;
  maxLevel?: number;
  maxCost?: number;
  upcast?: number;
  dc?: number;
  attack?: number;
  note?: string;
};
export type ItemSpells = Record<string, ItemSpellAccess>;
export type ItemSpellcasting = "character" | { dc?: number; attack?: number };
export type AmmoFamily = "arrow" | "bolt" | "energy-cell" | "firearm-bullet" | "needle" | "sling-bullet";
type ItemSpellTemplate =
  | { kind: "bound"; level?: number; minLevel?: number; maxLevel?: number; list?: string; schools?: string[]; cost?: number | "level"; uses?: number; consume?: true; prepared?: true; dc?: number; attack?: number; stats?: Record<string, { dc?: number; attack?: number }> }
  | { kind: "stored"; capacity: number; minLevel?: number; maxLevel?: number; initial?: string }
  | { kind: "choice"; list: string; level?: number; minLevel?: number; maxLevel?: number; uses?: number; recovery?: "short_rest" | "long_rest" }
  | { kind: "random"; die: string; when?: string; outcomes: Record<string, string | { id: string; level?: number; note?: string }> };
export type ItemSpellTemplates = ItemSpellTemplate | ItemSpellTemplate[];

export interface CompendiumItemDetail {
  id: string;
  name: string;
  ruleset?: "5e" | "5.5e";
  source?: string | null;
  rarity: string | null;
  type: string | null;
  attunement: boolean;
  magic: boolean;
  equippable?: boolean;
  weight: number | null;
  value: number | null;
  proficiency?: string | null;
  ac: number | null;
  stealthDisadvantage?: boolean;
  dmg1: string | null;
  dmg2: string | null;
  dmgType: string | null;
  properties: string[];
  mastery?: string | null;
  modifiers?: Array<{ target?: string; amount?: number }>;
  text: string | string[];
  uses?: ItemUses | null;
  spells?: ItemSpells | null;
  spellcasting?: ItemSpellcasting | null;
  spellTemplate?: ItemSpellTemplates | null;
  ammo?: AmmoFamily | null;
  weaponAmmo?: AmmoFamily | null;
  usage?: "held" | null;
  bundle?: ItemBundle | null;
  container?: boolean;
  ignoreWeight?: boolean;
  effects?: unknown[] | null;
}

export interface ItemSummaryRow {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  typeKey: string | null;
  attunement: boolean;
  magic: boolean;
  weight?: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  mastery?: string | null;
  modifiers?: Array<{ target?: string; amount?: number }>;
  uses?: ItemUses | null;
  spells?: ItemSpells | null;
  spellcasting?: ItemSpellcasting | null;
  spellTemplate?: ItemSpellTemplates | null;
  ammo?: AmmoFamily | null;
  weaponAmmo?: AmmoFamily | null;
  usage?: "held" | null;
  bundle?: ItemBundle | null;
  container?: boolean;
  ignoreWeight?: boolean;
  effects?: unknown[] | null;
}

export type EquipState = "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand" | "worn";

export interface ParsedItemSpell {
  id: string;
  cost: number | "level";
  level?: number;
  uses?: ItemUseAmount;
  maxLevel?: number;
  maxCost?: number;
  upcast?: number;
  dc?: number;
  attack?: number;
  consume?: true;
  note?: string;
}
