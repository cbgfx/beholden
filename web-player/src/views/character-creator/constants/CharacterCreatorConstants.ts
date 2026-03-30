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

export const MUSICAL_INSTRUMENTS = [
  "Bagpipes","Drum","Dulcimer","Flute","Lute","Lyre","Horn","Pan Flute","Shawm","Viol",
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
  "Improvised Weapons",
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

