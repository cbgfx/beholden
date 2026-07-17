import { type JsonRecord, record, list } from "./grandCompendium.helpers.js";
import { expandedItemDetail, itemTypeKey } from "./itemCompaction.js";

export function projectGrandItem(entry: JsonRecord): JsonRecord {
  const compact = entry;
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
    ammo: compact.ammo ?? null,
    usage: compact.usage ?? null,
    bundle: compact.bundle ?? null,
    container: compact.container === true,
    ignoreWeight: compact.ignoreWeight === true,
    effects: compact.effects ?? null,
    uses: compact.uses ?? null,
    spells: compact.spells ?? null,
    spellcasting: compact.spellcasting ?? null,
    spellTemplate: compact.spellTemplate ?? null,
    ac: armor.ac ?? null,
    stealthDisadvantage: armor.stealthDisadvantage === true,
    strengthRequirement: armor.strength ?? null,
    dmg1: weapon.damage ?? null,
    dmg2: weapon.twoHandedDamage ?? null,
    dmgType: weapon.damageType ?? null,
    range: weapon.range ?? null,
    properties: list(weapon.properties).map(String),
    mastery: weapon.mastery ?? null,
    weaponAmmo: weapon.ammo ?? null,
    detail: expandedItemDetail(compact),
    // Typed facts served as stored: consumers sum `amount` by `target`, no label parsing.
    modifiers: list(compact.modifiers),
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
