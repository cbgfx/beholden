import { ABILITY_LABELS, ALL_SKILLS } from "@/views/character/CharacterSheetConstants";

export { ABILITY_LABELS, ALL_SKILLS };

export const ALL_TOOLS = [
  "Alchemist's Supplies","Brewer's Supplies","Calligrapher's Supplies",
  "Carpenter's Tools","Cartographer's Tools","Cobbler's Tools","Cook's Utensils",
  "Glassblower's Tools","Jeweler's Tools","Leatherworker's Tools","Mason's Tools",
  "Painter's Supplies","Potter's Tools","Smith's Tools","Tinker's Tools",
  "Weaver's Tools","Woodcarver's Tools",
  "Disguise Kit","Forgery Kit","Herbalism Kit","Navigator's Tools",
  "Poisoner's Kit","Thieves' Tools",
  "Dice Set","Dragonchess Set","Playing Card Set","Three-Dragon Ante Set",
  "Bagpipes","Drum","Dulcimer","Flute","Lute","Lyre","Horn","Pan Flute","Shawm","Viol",
  "Land Vehicles","Water Vehicles","Sea Vehicles",
];

export const ALL_LANGUAGES = [
  "Common","Dwarvish","Elvish","Giant","Gnomish","Goblin","Halfling","Orcish",
  "Abyssal","Celestial","Draconic","Deep Speech","Infernal","Primordial","Sylvan","Undercommon",
  "Sign Language","Thieves' Cant",
];

export const ARMOR_PROFICIENCY_OPTIONS = [
  "Light Armor",
  "Medium Armor",
  "Heavy Armor",
  "Shield",
  "Shields",
];

export const WEAPON_PROFICIENCY_OPTIONS = [
  "Simple Weapons",
  "Martial Weapons",
  "Light Weapons",
  "Improvised Weapons",
  "Finesse Weapons",
  "Thrown Weapons",
  "Heavy Weapons",
  "Ranged Weapons",
  "Versatile Weapons",
  "Two-Handed Weapons",
  "Special Weapons",
  "Reach Weapons",
  "Loading Weapons",
];

export const SAVING_THROW_OPTIONS = [
  "Strength",
  "Dexterity",
  "Constitution",
  "Intelligence",
  "Wisdom",
  "Charisma",
];

export const WEAPON_MASTERY_KINDS = [
  "Battleaxe","Blowgun","Club","Dagger","Dart","Flail","Glaive","Greataxe","Greatclub","Greatsword",
  "Halberd","Hand Crossbow","Handaxe","Heavy Crossbow","Javelin","Lance","Light Crossbow","Light Hammer",
  "Longbow","Longsword","Mace","Maul","Morningstar","Musket","Pike","Pistol","Quarterstaff","Rapier",
  "Scimitar","Shortbow","Shortsword","Sickle","Sling","Spear","Trident","War Pick","Warhammer","Whip",
] as const;

export const WEAPON_MASTERY_KIND_SET = new Set<string>(WEAPON_MASTERY_KINDS);

/**
 * Martial/Light/Finesse flags per masterable weapon, matching the compendium's own weapon
 * property codes (verified directly against `WotC_2024_only.json`'s item records). Used to
 * resolve which weapons a class's weapon-proficiency text actually covers — e.g. Rogue's
 * "Simple Weapons and Martial Weapons that have the Finesse or Light property" only unlocks a
 * subset of martial weapons for Weapon Mastery, not all of them.
 */
const WEAPON_MASTERY_KIND_FLAGS: Record<(typeof WEAPON_MASTERY_KINDS)[number], { martial: boolean; light: boolean; finesse: boolean }> = {
  Battleaxe: { martial: true, light: false, finesse: false },
  Blowgun: { martial: true, light: false, finesse: false },
  Club: { martial: false, light: true, finesse: false },
  Dagger: { martial: false, light: true, finesse: true },
  Dart: { martial: false, light: false, finesse: true },
  Flail: { martial: false, light: false, finesse: false },
  Glaive: { martial: true, light: false, finesse: false },
  Greataxe: { martial: true, light: false, finesse: false },
  Greatclub: { martial: false, light: false, finesse: false },
  Greatsword: { martial: true, light: false, finesse: false },
  Halberd: { martial: true, light: false, finesse: false },
  "Hand Crossbow": { martial: true, light: true, finesse: false },
  Handaxe: { martial: false, light: true, finesse: false },
  "Heavy Crossbow": { martial: true, light: false, finesse: false },
  Javelin: { martial: false, light: false, finesse: false },
  Lance: { martial: true, light: false, finesse: false },
  "Light Crossbow": { martial: false, light: false, finesse: false },
  "Light Hammer": { martial: false, light: true, finesse: false },
  Longbow: { martial: true, light: false, finesse: false },
  Longsword: { martial: true, light: false, finesse: false },
  Mace: { martial: false, light: false, finesse: false },
  Maul: { martial: true, light: false, finesse: false },
  Morningstar: { martial: false, light: false, finesse: false },
  Musket: { martial: true, light: false, finesse: false },
  Pike: { martial: true, light: false, finesse: false },
  Pistol: { martial: true, light: false, finesse: false },
  Quarterstaff: { martial: false, light: false, finesse: false },
  Rapier: { martial: true, light: false, finesse: true },
  Scimitar: { martial: true, light: true, finesse: true },
  Shortbow: { martial: false, light: false, finesse: false },
  Shortsword: { martial: true, light: true, finesse: true },
  Sickle: { martial: false, light: true, finesse: false },
  Sling: { martial: false, light: false, finesse: false },
  Spear: { martial: false, light: false, finesse: false },
  Trident: { martial: true, light: false, finesse: false },
  "War Pick": { martial: true, light: false, finesse: false },
  Warhammer: { martial: true, light: false, finesse: false },
  Whip: { martial: true, light: false, finesse: true },
};

function weaponMasteryKindMatchesProficiencyText(kind: string, text: string): boolean {
  const flags = WEAPON_MASTERY_KIND_FLAGS[kind as (typeof WEAPON_MASTERY_KINDS)[number]];
  const normalized = text.trim().toLowerCase();
  if (!flags) return normalized === kind.toLowerCase();
  if (!flags.martial && /\bsimple weapons?\b/.test(normalized)) return true;
  if (flags.martial && /\bmartial weapons?\b/.test(normalized)) {
    if (/\bfinesse or light\b/.test(normalized)) return flags.finesse || flags.light;
    if (/\blight property\b/.test(normalized)) return flags.light;
    if (/\bfinesse property\b/.test(normalized)) return flags.finesse;
    return true;
  }
  return normalized === kind.toLowerCase();
}

/**
 * Filters {@link WEAPON_MASTERY_KINDS} down to the weapons a class's weapon-proficiency text
 * actually grants, so the Weapon Mastery picker only offers weapons the character can be
 * proficient with — not every masterable weapon in the game regardless of class.
 */
export function getEligibleWeaponMasteryKinds(weaponProficiencyTexts: string[] | null | undefined): string[] {
  const texts = weaponProficiencyTexts ?? [];
  if (texts.length === 0) return [];
  return WEAPON_MASTERY_KINDS.filter((kind) => texts.some((text) => weaponMasteryKindMatchesProficiencyText(kind, text)));
}

export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const POINT_BUY_BUDGET = 27;

export const ABILITY_NAME_TO_KEY: Record<string, string> = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

export const ABILITY_SCORE_NAMES = new Set([
  "Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma",
]);

export const STANDARD_55E_LANGUAGES = [
  "Common Sign Language",
  "Draconic",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
];

