import { normalizeKey } from "../../lib/text.js";
import { type JsonRecord, list, number, record, text } from "./grandCompendium.helpers.js";

function present<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function typedItemModifier(raw: unknown): Array<{ target: string; amount: number }> {
  const modifier = record(raw);
  if (typeof modifier.target === "string" && typeof modifier.amount === "number") {
    return [{ target: modifier.target, amount: modifier.amount }];
  }
  return [];
}

function descriptionBlocks(value: unknown): string[] {
  return (Array.isArray(value) ? value : present(value) ? [value] : [])
    .map(String)
    .map((block) => block.trim())
    .filter(Boolean);
}

function extractSource(blocks: string[], explicitSource: unknown): {
  description: string[];
  source?: string;
} {
  let source = text(explicitSource) ?? undefined;
  const description = [...blocks];
  if (!source && description.length > 0) {
    const last = description.at(-1)!;
    const match = last.match(/(?:^|\n)\s*Source:\s*(.+?)\s*$/iu);
    if (match) {
      source = match[1]!.trim();
      const withoutSource = last.slice(0, match.index).trim();
      if (withoutSource) description[description.length - 1] = withoutSource;
      else description.pop();
    }
  }
  return { description, ...(source ? { source } : {}) };
}

function redundantDetail(detail: string, rarity: string, attunement: true | string | undefined): boolean {
  const normalized = normalizeKey(detail);
  const normalizedRarity = normalizeKey(rarity);
  if (normalized === normalizedRarity) return true;
  if (attunement === true) {
    return normalized === `${normalizedRarity} (requires attunement)`;
  }
  if (typeof attunement === "string") {
    return normalized === `${normalizedRarity} (requires attunement by ${normalizeKey(attunement)})`;
  }
  return false;
}

/** Converts source or verbose item data into the sparse Grand shape. */
export function compactItemEntry(entry: JsonRecord): JsonRecord {
  const classification = record(entry.classification);
  const oldAttunement = record(entry.attunement);
  const equipment = record(entry.equipment);
  const oldArmor = record(entry.armor);
  const oldWeapon = record(entry.weapon);

  const id = text(entry.id) ?? "";
  const name = text(entry.name) ?? "";
  const type = text(classification.type ?? entry.type) ?? "Other";
  const rarity = (text(classification.rarity ?? entry.rarity) ?? "common").toLowerCase();
  const magical = classification.magical === true || entry.magical === true || entry.magic === true;

  const attunementRequired = oldAttunement.required === true || entry.attunement === true
    || typeof entry.attunement === "string";
  const requirements = text(
    oldAttunement.requirements
      ?? (typeof entry.attunement === "string" ? entry.attunement : entry.attunementRequirements),
  );
  const attunement: true | string | undefined = requirements
    ? requirements
    : attunementRequired ? true : undefined;

  const weight = number(equipment.weight ?? entry.weight);
  const value = number(equipment.value ?? entry.value);
  const proficiency = text(equipment.proficiency ?? entry.proficiency);
  const ammo = text(entry.ammo);
  const usage = text(entry.usage);
  const bundle = entry.bundle;
  const isContainer = entry.container === true;
  const ignoreWeight = entry.ignoreWeight === true;
  const effects = list(entry.effects);
  const equippable = equipment.equippable === true || entry.equippable === true;
  const uses = entry.uses;
  const spells = entry.spells;
  const spellcasting = entry.spellcasting;
  const spellTemplate = entry.spellTemplate;

  const armorClass = number(oldArmor.ac ?? oldArmor.armorClass ?? entry.ac);
  const strength = number(oldArmor.strength ?? oldArmor.strengthRequirement ?? entry.strengthRequirement);
  const stealthDisadvantage = oldArmor.stealthDisadvantage === true || entry.stealthDisadvantage === true;
  const armor = {
    ...(present(armorClass) ? { ac: armorClass } : {}),
    ...(stealthDisadvantage ? { stealthDisadvantage: true } : {}),
    ...(present(strength) ? { strength } : {}),
  };

  const damage = text(oldWeapon.damage ?? oldWeapon.oneHandedDamage ?? entry.dmg1);
  const twoHandedDamage = text(oldWeapon.twoHandedDamage ?? entry.dmg2);
  const damageType = text(oldWeapon.damageType ?? entry.dmgType);
  const range = text(oldWeapon.range ?? entry.range);
  const mastery = text(oldWeapon.mastery ?? entry.mastery);
  const weaponAmmo = text(oldWeapon.ammo);
  const properties = list(oldWeapon.properties ?? entry.properties).map(String).filter(Boolean);
  const weapon = {
    ...(damage ? { damage } : {}),
    ...(twoHandedDamage ? { twoHandedDamage } : {}),
    ...(damageType ? { damageType } : {}),
    ...(range ? { range } : {}),
    ...(properties.length ? { properties } : {}),
    ...(mastery ? { mastery } : {}),
    ...(weaponAmmo ? { ammo: weaponAmmo } : {}),
  };

  const sourceAndDescription = extractSource(
    descriptionBlocks(entry.description ?? entry.text),
    entry.source,
  );
  const description = sourceAndDescription.description.length <= 1
    ? sourceAndDescription.description[0] ?? ""
    : sourceAndDescription.description;

  const detail = text(entry.detail);
  const modifiers = list(entry.modifiers).flatMap(typedItemModifier);
  const rolls = list(entry.rolls).flatMap((raw) => {
    const roll = record(raw);
    const formula = text(roll.formula ?? roll["#text"] ?? raw);
    const rollDescription = text(roll.description ?? roll["@_description"]);
    return formula ? [{
      formula,
      ...(rollDescription ? { description: rollDescription } : {}),
    }] : [];
  });

  return {
    id,
    name,
    ...(sourceAndDescription.source ? { source: sourceAndDescription.source } : {}),
    type,
    rarity,
    ...(magical ? { magical: true } : {}),
    ...(attunement ? { attunement } : {}),
    ...(equippable ? { equippable: true } : {}),
    ...(present(weight) ? { weight } : {}),
    ...(present(value) ? { value } : {}),
    ...(proficiency ? { proficiency } : {}),
    ...(ammo ? { ammo } : {}),
    ...(usage ? { usage } : {}),
    ...(present(bundle) ? { bundle } : {}),
    ...(isContainer ? { container: true } : {}),
    ...(ignoreWeight ? { ignoreWeight: true } : {}),
    ...(effects.length ? { effects } : {}),
    ...(present(uses) ? { uses } : {}),
    ...(present(spells) ? { spells } : {}),
    ...(present(spellcasting) ? { spellcasting } : {}),
    ...(present(spellTemplate) ? { spellTemplate } : {}),
    ...(Object.keys(armor).length ? { armor } : {}),
    ...(Object.keys(weapon).length ? { weapon } : {}),
    ...(detail && !redundantDetail(detail, rarity, attunement) ? { detail } : {}),
    ...(modifiers.length ? { modifiers } : {}),
    ...(rolls.length ? { rolls } : {}),
    description,
  };
}

export function itemTypeKey(entry: JsonRecord): string {
  return normalizeKey(record(entry.classification).type ?? entry.type);
}

export function expandedItemDetail(entry: JsonRecord): string | null {
  const detail = text(entry.detail);
  if (detail) return detail;
  const rarity = text(entry.rarity) ?? "common";
  if (entry.attunement === true) return `${rarity} (requires attunement)`;
  if (typeof entry.attunement === "string") {
    return `${rarity} (requires attunement by ${entry.attunement})`;
  }
  return rarity;
}
