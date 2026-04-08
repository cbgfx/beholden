import type { AbilKey } from "@/views/character/CharacterSheetTypes";

export const ABILITY_LABELS: Record<AbilKey, string> = {
  str: "STR",
  dex: "DEX",
  con: "CON",
  int: "INT",
  wis: "WIS",
  cha: "CHA",
};

export const ABILITY_FULL: Record<AbilKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export const ALL_SKILLS: { name: string; abil: AbilKey }[] = [
  { name: "Acrobatics", abil: "dex" },
  { name: "Animal Handling", abil: "wis" },
  { name: "Arcana", abil: "int" },
  { name: "Athletics", abil: "str" },
  { name: "Deception", abil: "cha" },
  { name: "History", abil: "int" },
  { name: "Insight", abil: "wis" },
  { name: "Intimidation", abil: "cha" },
  { name: "Investigation", abil: "int" },
  { name: "Medicine", abil: "wis" },
  { name: "Nature", abil: "int" },
  { name: "Perception", abil: "wis" },
  { name: "Performance", abil: "cha" },
  { name: "Persuasion", abil: "cha" },
  { name: "Religion", abil: "int" },
  { name: "Sleight of Hand", abil: "dex" },
  { name: "Stealth", abil: "dex" },
  { name: "Survival", abil: "wis" },
];

