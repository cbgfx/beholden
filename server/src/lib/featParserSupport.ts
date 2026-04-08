import {
  ALL_LANGUAGES,
  ALL_SKILLS,
  ALL_TOOLS,
} from "./proficiencyConstants.js";

export const ABILITY_SCORES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] as const;
export const DAMAGE_TYPES = ["Acid", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder"] as const;
export const KNOWN_CANTRIPS = [
  "Acid Splash", "Blade Ward", "Booming Blade", "Chill Touch", "Control Flames", "Create Bonfire",
  "Dancing Lights", "Druidcraft", "Eldritch Blast", "Elementalism", "Fire Bolt", "Friends", "Frostbite",
  "Green-Flame Blade", "Guidance", "Gust", "Infestation", "Light", "Lightning Lure", "Mage Hand",
  "Magic Stone", "Mending", "Message", "Mind Sliver", "Minor Illusion", "Mold Earth", "Poison Spray",
  "Prestidigitation", "Produce Flame", "Ray of Frost", "Resistance", "Sacred Flame", "Shape Water",
  "Shillelagh", "Shocking Grasp", "Sorcerous Burst", "Spare the Dying", "Starry Wisp", "Thaumaturgy",
  "Thorn Whip", "Thunderclap", "Toll the Dead", "True Strike", "Vicious Mockery", "Word of Radiance",
] as const;
export const WEAPON_MASTERY_KINDS = [
  "Battleaxe", "Blowgun", "Club", "Dagger", "Dart", "Flail", "Glaive", "Greataxe", "Greatclub", "Greatsword",
  "Halberd", "Hand Crossbow", "Handaxe", "Heavy Crossbow", "Javelin", "Lance", "Light Crossbow", "Light Hammer",
  "Longbow", "Longsword", "Mace", "Maul", "Morningstar", "Musket", "Pike", "Pistol", "Quarterstaff", "Rapier",
  "Scimitar", "Shortbow", "Shortsword", "Sickle", "Sling", "Spear", "Trident", "War Pick", "Warhammer", "Whip",
] as const;

function findExplicitOptions(text: string, canonical: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return canonical
    .filter((name) => lower.includes(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
}

export function parseAbilityOptions(text: string): string[] {
  return findExplicitOptions(text, ABILITY_SCORES);
}

export function parseDamageTypeOptions(text: string): string[] {
  return findExplicitOptions(text, DAMAGE_TYPES);
}

export function parseToolOptions(text: string): string[] {
  return findExplicitOptions(text, ALL_TOOLS);
}

export function parseSkillOptions(text: string): string[] {
  return findExplicitOptions(text, ALL_SKILLS);
}

export function parseLanguageOptions(text: string): string[] {
  return findExplicitOptions(text, ALL_LANGUAGES);
}

export function parseWeaponProficiencyGrants(text: string): string[] {
  const normalized = String(text ?? "").trim().toLowerCase();
  if (!normalized) return [];

  const results = new Set<string>();
  if (/\bsimple\b/.test(normalized)) results.add("Simple Weapons");
  if (/\bmartial\b/.test(normalized)) results.add("Martial Weapons");
  if (/\blight\b/.test(normalized)) results.add("Light Weapons");
  if (/\bimprovised\b/.test(normalized)) results.add("Improvised Weapons");
  if (/\bfinesse\b/.test(normalized)) results.add("Finesse Weapons");
  if (/\bthrown\b/.test(normalized)) results.add("Thrown Weapons");
  if (/\bheavy\b/.test(normalized)) results.add("Heavy Weapons");
  if (/\brange(?:d)?\b/.test(normalized)) results.add("Ranged Weapons");
  if (/\bversatile\b/.test(normalized)) results.add("Versatile Weapons");
  if (/\btwo[-\s]?handed\b|\b2h\b/.test(normalized)) results.add("Two-Handed Weapons");
  if (/\bspecial\b/.test(normalized)) results.add("Special Weapons");
  if (/\breach\b/.test(normalized)) results.add("Reach Weapons");
  if (/\bloading\b/.test(normalized)) results.add("Loading Weapons");
  return Array.from(results);
}

export function splitList(text: string): string[] {
  return text
    .replace(/\band\b/gi, ",")
    .replace(/\bor\b/gi, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function wordToNumber(value: string): number {
  const lowered = value.trim().toLowerCase();
  const lookup: Record<string, number> = {
    a: 1,
    an: 1,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  const parsed = Number.parseInt(lowered, 10);
  return Number.isFinite(parsed) ? parsed : (lookup[lowered] ?? 1);
}
