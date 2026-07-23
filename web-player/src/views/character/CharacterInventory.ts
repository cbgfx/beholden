import {
  canAddAbilityModifierToExtraAttackDamageFromEffects,
  canUseWeaponForBonusAttackFromEffects,
  deriveAttackAbilityOverrideFromEffects,
} from "@/domain/character/parseFeatureEffects";
import { formatItemDamageType, formatItemProperties, isCurrencyName, normalizeInventoryItemLookupName, itemModifierBonus } from "@beholden/shared/domain";
import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import { abilityMod, normalizeWeaponProficiencyName, splitArmorProficiencyNames } from "@/views/character/CharacterSheetUtils";
import { rollDiceExpr } from "@/lib/dice";
import type {
  CharacterLike,
  EquipState,
  InventoryContainer,
  InventoryItem,
  ItemSpells,
  ItemSummaryRow,
  ItemUseAmount,
  ItemUses,
  ParsedItemSpell,
  ProficiencyMapLike,
} from "@/views/character/CharacterInventoryTypes";

export * from "@/views/character/CharacterInventoryTypes";
export { formatItemDamageType, formatItemProperties, normalizeInventoryItemLookupName };

/** Merges a stored inventory item with its live catalog record. Catalog-linked items are read
 * live, not frozen at add-time: every definitional fact (AC, damage, modifiers, spell grants,
 * ...) is overwritten from the current catalog record every time it's fetched, so a compendium
 * fix reaches every character that holds the item without a manual backfill. Only genuinely
 * player-owned state — quantity, equip/container placement, and the item's *current* charge
 * count — stays local; those aren't touched here. Custom items (no itemId, source "custom") are
 * exempt: there's no catalog record to defer to. */
export function mergeCatalogItem(item: InventoryItem, summary: ItemSummaryRow, chargesMax: number | null): InventoryItem {
  const isLinked = item.source !== "custom" || Boolean(item.itemId);
  function catalog<T>(fromCatalog: T | null | undefined, fromStored: T | null | undefined): T | null | undefined {
    return isLinked && fromCatalog != null ? fromCatalog : fromStored;
  }
  const resolvedChargesMax = isLinked ? chargesMax : (item.chargesMax ?? chargesMax);
  const resolvedCharges = item.charges == null
    ? resolvedChargesMax
    : resolvedChargesMax == null ? item.charges : Math.min(item.charges, resolvedChargesMax);
  return {
    ...item,
    name: item.source === "custom" && !item.itemId
      ? item.name
      : summary.name.replace(/\s+\[(?:2024|5\.5e)\]\s*$/i, "").trim(),
    source: item.source === "custom" && !item.itemId ? item.source : "compendium",
    itemId: item.itemId ?? summary.id,
    type: catalog(summary.type, item.type),
    rarity: catalog(summary.rarity, item.rarity),
    magic: catalog(summary.magic, item.magic) ?? undefined,
    attunement: catalog(summary.attunement, item.attunement) ?? undefined,
    weight: catalog(summary.weight, item.weight) ?? null,
    value: catalog(summary.value, item.value) ?? null,
    ac: catalog(summary.ac, item.ac) ?? null,
    stealthDisadvantage: catalog(summary.stealthDisadvantage, item.stealthDisadvantage) ?? false,
    dmg1: catalog(summary.dmg1, item.dmg1) ?? null,
    dmg2: catalog(summary.dmg2, item.dmg2) ?? null,
    dmgType: catalog(summary.dmgType, item.dmgType) ?? null,
    properties: catalog(summary.properties, item.properties) ?? [],
    mastery: catalog(summary.mastery, item.mastery) ?? null,
    modifiers: catalog(summary.modifiers, item.modifiers) ?? [],
    uses: item.uses ?? summary.uses ?? null,
    spells: catalog(summary.spells, item.spells) ?? null,
    spellcasting: catalog(summary.spellcasting, item.spellcasting) ?? null,
    spellTemplate: catalog(summary.spellTemplate, item.spellTemplate) ?? null,
    ammo: catalog(summary.ammo, item.ammo) ?? null,
    weaponAmmo: catalog(summary.weaponAmmo, item.weaponAmmo) ?? null,
    usage: catalog(summary.usage, item.usage) ?? null,
    effects: catalog(summary.effects, item.effects) ?? null,
    chargesMax: resolvedChargesMax,
    charges: resolvedCharges,
  };
}

/** Returns the mastery assignment authored on the canonical weapon record. */
export function getWeaponMasteryName(item: Pick<InventoryItem, "mastery"> | null | undefined): string | null {
  return String(item?.mastery ?? "").trim() || null;
}

/**
 * Reads a weapon's magic attack-roll bonus from its compendium `modifiers` (e.g. a "+1" weapon's
 * `{ text: "weapon attacks +1" }`, or a bow's `{ text: "ranged attacks +1" }`) rather than
 * regexing a "+N" out of the item's name — the name isn't guaranteed to spell out the bonus, and
 * the modifiers are already the compendium's own structured record of it. Checks both the
 * generic "weapon" category and the melee/ranged-specific one, since the compendium uses either
 * depending on the item (compare Returning Dagger's "weapon attacks" to Longbow +1's
 * "ranged attacks").
 */
export function weaponAttackModifierBonus(
  item: Pick<InventoryItem, "modifiers"> | null | undefined,
  isRanged: boolean,
): number {
  return itemModifierBonus(item?.modifiers, "weapon_attacks")
    + itemModifierBonus(item?.modifiers, isRanged ? "ranged_attacks" : "melee_attacks");
}

/** Damage-roll counterpart to {@link weaponAttackModifierBonus}. */
export function weaponDamageModifierBonus(
  item: Pick<InventoryItem, "modifiers"> | null | undefined,
  isRanged: boolean,
): number {
  return itemModifierBonus(item?.modifiers, "weapon_damage")
    + itemModifierBonus(item?.modifiers, isRanged ? "ranged_damage" : "melee_damage");
}

export function hasWeaponMastery(item: Pick<InventoryItem, "proficiency" | "name"> | null | undefined, prof: ProficiencyMapLike | undefined): boolean {
  return Boolean(item) && hasWeaponProficiency(item as InventoryItem, prof);
}

function isShieldOrHeld(item: InventoryItem): boolean {
  return isShieldItem(item) || item.usage === "held";
}

export function isArmorItem(item: InventoryItem): boolean {
  return /^(?:light|medium|heavy) armor$/i.test(String(item.type ?? "").trim());
}

export function hasStealthDisadvantage(item: { stealthDisadvantage?: boolean }): boolean {
  return item.stealthDisadvantage === true;
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
  return /^shield$/i.test(String(item.type ?? "").trim());
}

export function requiresTwoHands(item: InventoryItem): boolean {
  return isWeaponItem(item) && hasItemProperty(item, "2H");
}

function armorProficiencyNameForItem(item: InventoryItem): "Light Armor" | "Medium Armor" | "Heavy Armor" | "Shields" | null {
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
  return item.equipState ?? "backpack";
}

export function isWeaponItem(item: InventoryItem): boolean {
  return Boolean(item.dmg1 || item.dmg2);
}

/** Items that are worn/held as wondrous gear (rings, rods, wands, amulets, etc.) but are not weapons or armor. */
export function isWearableItem(item: InventoryItem): boolean {
  if (isWeaponItem(item) || isArmorItem(item) || isShieldItem(item)) return false;
  return item.equippable === true;
}

export function getItemSpells(spells: ItemSpells | null | undefined): ParsedItemSpell[] {
  return Object.entries(spells ?? {}).map(([id, access]) => {
    if (typeof access === "number" || access === "level") return { id, cost: access };
    return { id, ...access, cost: access.cost ?? 0 };
  });
}

export function fixedItemUsesMaximum(uses: ItemUses | null | undefined): number | null {
  const maximum = uses && typeof uses === "object" ? uses.max : uses;
  return typeof maximum === "number" && Number.isInteger(maximum) && maximum > 0 ? maximum : null;
}

function resolveItemUseAmount(amount: ItemUseAmount, roll: (formula: string) => number): number {
  return typeof amount === "number" ? amount : roll(amount);
}

export function initializeItemUsesMaximum(
  uses: ItemUses | null | undefined,
  roll: (formula: string) => number = rollDiceExpr,
): number | null {
  if (uses == null) return null;
  const maximum = uses && typeof uses === "object" ? uses.max : uses;
  const resolved = resolveItemUseAmount(maximum, roll);
  return Number.isInteger(resolved) && resolved > 0 ? resolved : null;
}

export function recoverItemCharges(
  item: InventoryItem,
  roll: (formula: string) => number = rollDiceExpr,
): InventoryItem {
  const maximum = item.chargesMax ?? initializeItemUsesMaximum(item.uses, roll);
  if (!maximum) return item;
  if (item.uses && typeof item.uses === "object" && item.uses.recover === false) return item;
  const recovery = item.uses && typeof item.uses === "object" ? item.uses.recover : undefined;
  if (recovery === false) return item;
  const charges = recovery === undefined
    ? maximum
    : Math.min(maximum, Math.max(0, item.charges ?? maximum) + resolveItemUseAmount(recovery, roll));
  return { ...item, chargesMax: maximum, charges };
}

export function hasItemProperty(item: InventoryItem, code: string): boolean {
  return (item.properties ?? []).some((p) => String(p).trim().toUpperCase() === code.toUpperCase());
}

export function canEquipOffhand(
  item: InventoryItem,
  parsedFeatureEffects: ParsedFeatureEffects[] | null | undefined
): boolean {
  if (isShieldOrHeld(item)) return true;
  if (!isWeaponItem(item)) return false;
  if (!isRangedWeapon(item) && !requiresTwoHands(item) && hasItemProperty(item, "L")) return true;
  if (canUseWeaponForBonusAttackFromEffects(parsedFeatureEffects ?? [], item)) return true;
  return false;
}

export function canUseTwoHands(item: InventoryItem): boolean {
  return isWeaponItem(item) && (requiresTwoHands(item) || Boolean(item.dmg2));
}

function isMartialWeapon(item: InventoryItem): boolean {
  return hasItemProperty(item, "M");
}

function isMonkWeapon(item: InventoryItem): boolean {
  if (!isWeaponItem(item) || isRangedWeapon(item)) return false;
  if (isSimpleWeapon(item)) return !hasItemProperty(item, "2H") && !hasItemProperty(item, "H");
  return isMartialWeapon(item) && hasItemProperty(item, "L");
}

export function isRangedWeapon(item: InventoryItem): boolean {
  return /ranged/i.test(item.type ?? "");
}

export function isAmmunitionItem(item: InventoryItem): boolean {
  return item.ammo != null;
}

export function isCompatibleAmmunition(weapon: InventoryItem, ammunition: InventoryItem): boolean {
  return weapon.weaponAmmo != null && weapon.weaponAmmo === ammunition.ammo;
}

export function weaponAbilityMod(
  item: InventoryItem,
  char: CharacterLike,
  parsedFeatureEffects?: ParsedFeatureEffects[] | null | undefined,
): number {
  const strMod = abilityMod(char.strScore);
  const dexMod = abilityMod(char.dexScore);
  const abilityOverride = deriveAttackAbilityOverrideFromEffects(parsedFeatureEffects ?? [], {
    isWeapon: true,
    isMonkWeapon: isMonkWeapon(item),
  });
  if (abilityOverride === "dex") return dexMod;
  if (abilityOverride === "str") return strMod;
  if (hasItemProperty(item, "F")) return Math.max(strMod, dexMod);
  if (isRangedWeapon(item)) return dexMod;
  return strMod;
}

export function weaponDamageDice(item: InventoryItem, state: "mainhand-1h" | "mainhand-2h" | "offhand"): string | null {
  if (state === "mainhand-2h") return item.dmg2 ?? item.dmg1 ?? null;
  return item.dmg1 ?? item.dmg2 ?? null;
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
  const baseWeapon = normalizeWeaponProficiencyName(String(item.proficiency ?? "").split(",").at(-1) ?? "").toLowerCase();

  if (!normalized) return false;
  if (normalized === itemName) return true;
  if (baseWeapon && normalized === baseWeapon) return true;
  if (weaponMatchesQualifier(item, normalized)) return true;
  return normalized === itemName;
}

export function formatWeaponProficiencyName(name: string): string {
  return normalizeWeaponProficiencyName(name);
}

export function hasWeaponProficiency(item: InventoryItem, prof: ProficiencyMapLike | undefined): boolean {
  return (prof?.weapons ?? []).some((entry) => {
    const filter = entry.weaponFilter;
    if (filter) {
      if (filter.melee && isRangedWeapon(item)) return false;
      if (filter.martial && !isMartialWeapon(item)) return false;
      if (filter.excludeProperties?.includes("heavy") && hasItemProperty(item, "H")) return false;
      if (filter.excludeProperties?.includes("two_handed") && hasItemProperty(item, "2H")) return false;
      return isWeaponItem(item);
    }
    return weaponMatchesProficiency(item, entry.name);
  });
}
