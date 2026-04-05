import { titleCase } from "@/lib/format/titleCase";
import {
  canAddAbilityModifierToExtraAttackDamageFromEffects,
  canUseWeaponForBonusAttackFromEffects,
} from "@/domain/character/parseFeatureEffects";
import { currencyCodeForName, formatItemDamageType, formatItemProperties, isCurrencyName, normalizeInventoryItemLookupName } from "@beholden/shared/domain";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import type { CharacterData, ProficiencyMap, TaggedItem } from "@/views/character/CharacterSheetTypes";
import { abilityMod, normalizeWeaponProficiencyName, splitArmorProficiencyNames } from "@/views/character/CharacterSheetUtils";

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
  description?: string;
  chargesMax?: number | null;
  charges?: number | null;
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
  description?: string;
}

export interface CompendiumItemDetail {
  id: string;
  name: string;
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
  modifiers?: Array<{ category?: string; text?: string }>;
  text: string | string[];
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
}

export type EquipState = "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand" | "worn";

export { formatItemDamageType, formatItemProperties, normalizeInventoryItemLookupName };

export interface ParsedItemSpell {
  name: string;
  cost: number;
}

export interface WeaponMasteryInfo {
  name: string;
  text: string;
}

// D&D 2024 weapon mastery property map (weapon name → mastery name)
const WEAPON_MASTERY_BY_WEAPON: Record<string, string> = {
  // Cleave
  greataxe: "Cleave", halberd: "Cleave",
  // Graze
  glaive: "Graze", greatsword: "Graze",
  // Nick
  club: "Nick", dagger: "Nick", "light hammer": "Nick", scimitar: "Nick",
  // Push
  greatclub: "Push", "heavy crossbow": "Push", pike: "Push", warhammer: "Push",
  // Sap
  flail: "Sap", longsword: "Sap", mace: "Sap", morningstar: "Sap", "war pick": "Sap", spear: "Sap",
  // Slow
  javelin: "Slow", "light crossbow": "Slow", longbow: "Slow", musket: "Slow", shortbow: "Slow", sling: "Slow",
  // Topple
  battleaxe: "Topple", lance: "Topple", maul: "Topple", quarterstaff: "Topple", trident: "Topple",
  // Vex
  blowgun: "Vex", dart: "Vex", "hand crossbow": "Vex", rapier: "Vex", shortsword: "Vex",
};

/** Returns the mastery property name for a weapon (e.g. "Sap" for Mace), checking description first then static map. */
export function getWeaponMasteryName(item: Pick<InventoryItem, "name" | "description"> | null | undefined): string | null {
  const fromDesc = parseWeaponMastery(item);
  if (fromDesc) return fromDesc.name;
  const key = stripMagicBonusFromName(String(item?.name ?? "")).toLowerCase();
  return WEAPON_MASTERY_BY_WEAPON[key] ?? null;
}

/** Returns the numeric magic bonus (+1/+2/+3) from an item name or description, or 0. */
export function parseMagicBonus(item: Pick<InventoryItem, "name" | "description"> | null | undefined): number {
  const nameMatch = String(item?.name ?? "").match(/[+](\d+)/);
  if (nameMatch) return parseInt(nameMatch[1], 10);
  const descMatch = String(item?.description ?? "").match(/[+](\d+)\s+bonus\s+to\s+attack\s+and\s+damage/i);
  if (descMatch) return parseInt(descMatch[1], 10);
  return 0;
}

function stripMagicBonusFromName(name: string): string {
  return name.replace(/\s*[+]\d+\s*$/, "").replace(/^[+]\d+\s+/, "").trim();
}

export function parseWeaponMastery(item: Pick<InventoryItem, "description"> | null | undefined): WeaponMasteryInfo | null {
  const raw = String(item?.description ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/^\s*([A-Za-z][A-Za-z\s'-]+)\s+\(Mastery\):\s*([\s\S]+)$/im);
  if (!match) return null;
  const name = titleCase(match[1].trim());
  const remainder = match[2].trim();
  const text = remainder
    .split(/\n\s*\n/)[0]
    .split(/\n(?=[A-Z][A-Za-z' -]+:)/)[0]
    .trim();
  if (!name || !text) return null;
  return { name, text };
}

export function hasWeaponMastery(item: Pick<InventoryItem, "proficiency" | "name"> | null | undefined, prof: ProficiencyMapLike | undefined): boolean {
  return Boolean(item) && hasWeaponProficiency(item as InventoryItem, prof);
}

export function isShieldOrTorch(item: InventoryItem): boolean {
  const type = String(item.type ?? "").toLowerCase();
  const name = String(item.name ?? "").toLowerCase();
  return type.includes("shield") || name.includes("shield") || name.includes("torch");
}

export function isArmorItem(item: InventoryItem): boolean {
  return /\barmor\b/i.test(item.type ?? "") && !isShieldOrTorch(item);
}

export function hasStealthDisadvantage(item: { stealthDisadvantage?: boolean; description?: string | null }): boolean {
  if (item.stealthDisadvantage) return true;
  return /disadvantage on stealth/i.test(String(item.description ?? ""));
}

export function currencyCodeForItem(item: Pick<InventoryItem, "name"> | null | undefined): "PP" | "GP" | "EP" | "SP" | "CP" | null {
  return currencyCodeForName(item?.name);
}

export function isCurrencyItem(item: Pick<InventoryItem, "name"> | null | undefined): boolean {
  return isCurrencyName(item?.name);
}

export function addsAbilityModToOffhandDamage(
  item: InventoryItem,
  parsedFeatureEffects: ParsedFeatureEffects[] | null | undefined
): boolean {
  return canAddAbilityModifierToExtraAttackDamageFromEffects(parsedFeatureEffects ?? [], item);
}

export function isShieldItem(item: InventoryItem): boolean {
  const type = String(item.type ?? "").toLowerCase();
  const name = String(item.name ?? "").toLowerCase();
  return type.includes("shield") || (name.includes("shield") && !name.includes("torch"));
}

export function requiresTwoHands(item: InventoryItem): boolean {
  return isWeaponItem(item) && hasItemProperty(item, "2H");
}

export function armorProficiencyNameForItem(item: InventoryItem): "Light Armor" | "Medium Armor" | "Heavy Armor" | "Shields" | null {
  if (isShieldItem(item)) return "Shields";
  const type = String(item.type ?? "").toLowerCase();
  if (type.includes("light armor")) return "Light Armor";
  if (type.includes("medium armor")) return "Medium Armor";
  if (type.includes("heavy armor")) return "Heavy Armor";
  if (type.includes("shield")) return "Shields";
  return null;
}

export function hasArmorProficiency(item: InventoryItem, prof: ProficiencyMapLike | undefined): boolean {
  const required = armorProficiencyNameForItem(item);
  if (!required) return true;
  const names = (prof?.armor ?? []).flatMap((entry) => splitArmorProficiencyNames(String(entry.name ?? "")).map((name) => name.toLowerCase()));
  return names.includes(required.toLowerCase());
}

export function getEquipState(item: InventoryItem): EquipState {
  if (item.equipState) return item.equipState;
  if (item.equipped) {
    if (isArmorItem(item)) return "worn";
    if (isWearableItem(item)) return "worn";
    if (requiresTwoHands(item)) return "mainhand-2h";
    if (!item.dmg1 && item.dmg2) return "mainhand-2h";
    return "mainhand-1h";
  }
  return "backpack";
}

export function isWeaponItem(item: InventoryItem): boolean {
  return Boolean(item.dmg1) || /weapon/i.test(item.type ?? "") || /\bstaff\b/i.test(item.type ?? "");
}

/** Items that are worn/held as wondrous gear (rings, rods, wands, amulets, etc.) but are not weapons or armor. */
export function isWearableItem(item: InventoryItem): boolean {
  if (isWeaponItem(item) || isArmorItem(item) || isShieldItem(item)) return false;
  if (item.equippable) return true;
  return /^(ring|rod|wand)$/i.test(item.type ?? "");
}

export function parseItemSpells(text: string): ParsedItemSpell[] {
  const results: ParsedItemSpell[] = [];
  const lines = text.split("\n");
  let inTable = false;
  for (const line of lines) {
    const t = line.trim();
    if (/spell\s*\|.*charge/i.test(t)) { inTable = true; continue; }
    if (inTable) {
      const m = t.match(/^(.+?)\s*\|\s*(\d+)/);
      if (m) results.push({ name: m[1].trim(), cost: parseInt(m[2], 10) });
      else if (t && !t.includes("|")) inTable = false;
    }
  }
  return results;
}

export function parseChargesMax(text: string): number | null {
  const m = text.match(/has (\d+) charges?/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

export function hasItemProperty(item: InventoryItem, code: string): boolean {
  return (item.properties ?? []).some((p) => String(p).trim().toUpperCase() === code.toUpperCase());
}

export function canEquipOffhand(
  item: InventoryItem,
  parsedFeatureEffects: ParsedFeatureEffects[] | null | undefined
): boolean {
  if (isShieldOrTorch(item)) return true;
  if (!isWeaponItem(item)) return false;
  if (!requiresTwoHands(item)) return true;
  if (canUseWeaponForBonusAttackFromEffects(parsedFeatureEffects ?? [], item)) return true;
  return false;
}

export function canUseTwoHands(item: InventoryItem): boolean {
  return isWeaponItem(item) && (requiresTwoHands(item) || Boolean(item.dmg2));
}

function isMartialWeapon(item: InventoryItem): boolean {
  return hasItemProperty(item, "M");
}

export function isRangedWeapon(item: InventoryItem): boolean {
  return /ranged/i.test(item.type ?? "");
}

function isStaffLikeWeapon(item: InventoryItem): boolean {
  const type = String(item.type ?? "").toLowerCase();
  const name = String(item.name ?? "").toLowerCase();
  return type.includes("staff") || name.includes("staff");
}

function defaultWeaponDamageDice(item: InventoryItem, state: "mainhand-1h" | "mainhand-2h" | "offhand"): string | null {
  if (isStaffLikeWeapon(item)) return state === "mainhand-2h" ? "1d8" : "1d6";
  return null;
}

export function weaponAbilityMod(item: InventoryItem, char: CharacterLike): number {
  const strMod = abilityMod(char.strScore);
  const dexMod = abilityMod(char.dexScore);
  if (hasItemProperty(item, "F")) return Math.max(strMod, dexMod);
  if (isRangedWeapon(item)) return dexMod;
  return strMod;
}

export function weaponDamageDice(item: InventoryItem, state: "mainhand-1h" | "mainhand-2h" | "offhand"): string | null {
  if (state === "mainhand-2h") return item.dmg2 ?? item.dmg1 ?? defaultWeaponDamageDice(item, state);
  return item.dmg1 ?? item.dmg2 ?? defaultWeaponDamageDice(item, state);
}

export function totalInventoryWeight(items: InventoryItem[], containers: InventoryContainer[] = []): number {
  const ignoredContainerIds = new Set(
    containers
      .filter((container) => container.ignoreWeight)
      .map((container) => container.id)
  );
  return items.reduce((sum, item) => {
    if (item.containerId && ignoredContainerIds.has(item.containerId)) return sum;
    const weight = typeof item.weight === "number" && Number.isFinite(item.weight) ? item.weight : 0;
    const qty = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
    return sum + (weight * Math.max(1, qty));
  }, 0);
}

export function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function isSimpleWeapon(item: InventoryItem): boolean {
  return isWeaponItem(item) && !isMartialWeapon(item);
}

function weaponMatchesQualifier(item: InventoryItem, qualifier: string): boolean {
  const normalized = normalizeWeaponProficiencyName(qualifier).toLowerCase();
  if (!normalized) return false;
  if (normalized === "simple weapons") return isSimpleWeapon(item);
  if (normalized === "martial weapons") return isMartialWeapon(item);
  if (normalized === "improvised weapons") return /improvised/i.test(item.type ?? "") || /improvised/i.test(item.name);
  if (normalized === "light weapons") return isWeaponItem(item) && hasItemProperty(item, "L");
  if (normalized === "finesse weapons") return isWeaponItem(item) && hasItemProperty(item, "F");
  if (normalized === "thrown weapons") return isWeaponItem(item) && hasItemProperty(item, "T");
  if (normalized === "heavy weapons") return isWeaponItem(item) && hasItemProperty(item, "H");
  if (normalized === "ranged weapons") return isRangedWeapon(item);
  if (normalized === "versatile weapons") return isWeaponItem(item) && hasItemProperty(item, "V");
  if (normalized === "two-handed weapons") return isWeaponItem(item) && hasItemProperty(item, "2H");
  if (normalized === "special weapons") return isWeaponItem(item) && hasItemProperty(item, "S");
  if (normalized === "reach weapons") return isWeaponItem(item) && hasItemProperty(item, "R");
  if (normalized === "loading weapons") return isWeaponItem(item) && hasItemProperty(item, "LD");
  return false;
}

function weaponMatchesProficiency(item: InventoryItem, proficiencyName: string): boolean {
  const normalized = normalizeWeaponProficiencyName(proficiencyName).toLowerCase();
  const itemName = normalizeInventoryItemLookupName(item.name);

  if (!normalized) return false;
  if (normalized === itemName) return true;
  if (weaponMatchesQualifier(item, normalized)) return true;
  return normalized === itemName;
}

export function formatWeaponProficiencyName(name: string): string {
  return normalizeWeaponProficiencyName(name);
}

export function hasWeaponProficiency(item: InventoryItem, prof: ProficiencyMapLike | undefined): boolean {
  return (prof?.weapons ?? []).some((entry) => weaponMatchesProficiency(item, entry.name));
}

export function conditionDisplayWeaponMeta(item: InventoryItem): string {
  const meta = [
    item.rarity ? titleCase(item.rarity) : null,
    item.type ?? null,
    item.attunement ? "Attunement" : null,
    item.magic ? "Magic" : null,
  ].filter(Boolean);
  return meta.join(" • ");
}
