import { isCanonicalV2Shape, upgradeCanonicalV2Entry } from "./nativeCompendiumV2Migration.js";
import { type JsonRecord, record, list } from "./nativeCompendiumV2.helpers.js";
import { compactItemEntry, expandedItemDetail, itemTypeKey } from "./itemCompaction.js";

export function itemToV2(entry: JsonRecord): JsonRecord {
  if (isCanonicalV2Shape("items", entry)) return upgradeCanonicalV2Entry("items", entry);
  return compactItemEntry(entry);
}

export function itemFromV2(entry: JsonRecord): JsonRecord {
  const compact = compactItemEntry(entry);
  const armor = record(compact.armor);
  const weapon = record(compact.weapon);
  const attunementRequirements = typeof compact.attunement === "string"
    ? compact.attunement
    : null;
  return {
    id: compact.id,
    name: compact.name,
    source: compact.source ?? null,
    type: compact.type,
    typeKey: itemTypeKey(compact),
    rarity: compact.rarity,
    magic: compact.magical === true,
    attunement: compact.attunement === true || attunementRequirements !== null,
    attunementRequirements,
    equippable: compact.equippable === true,
    weight: compact.weight ?? null,
    value: compact.value ?? null,
    proficiency: compact.proficiency ?? null,
    ac: armor.ac ?? null,
    stealthDisadvantage: armor.stealthDisadvantage === true,
    strengthRequirement: armor.strength ?? null,
    dmg1: weapon.damage ?? null,
    dmg2: weapon.twoHandedDamage ?? null,
    dmgType: weapon.damageType ?? null,
    range: weapon.range ?? null,
    properties: list(weapon.properties).map(String),
    detail: expandedItemDetail(compact),
    modifiers: list(compact.modifiers).map((raw) => {
      const modifier = record(raw);
      return { category: modifier.category ?? "", text: modifier.value ?? "" };
    }),
    rolls: list(compact.rolls).map((raw) => {
      const roll = record(raw);
      return {
        description: roll.description ?? null,
        formula: roll.formula ?? "",
      };
    }),
    text: (Array.isArray(compact.description) ? compact.description : [compact.description]).map(String),
  };
}
