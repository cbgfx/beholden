import {
  ALL_LANGUAGES,
  ALL_SKILLS,
  ALL_TOOLS,
} from "./proficiencyConstants.js";
import type { ParsedFeatChoice, ParsedFeatUse } from "./featParserTypes.js";

export const ABILITY_SCORES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] as const;
const DAMAGE_TYPES = ["Acid", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder"] as const;
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

export function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

export function addIfMissing(list: string[], values: string[]) {
  for (const value of values) {
    if (!list.includes(value)) list.push(value);
  }
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function normalizeChoiceDomain(value: string): string {
  const lowered = value.toLowerCase();
  if (lowered.startsWith("skill")) return "skill";
  if (lowered.startsWith("tool")) return "tool";
  if (lowered.startsWith("language")) return "language";
  return lowered;
}

export function pushChoice(choices: ParsedFeatChoice[], choice: ParsedFeatChoice) {
  const key = JSON.stringify({
    type: choice.type,
    count: choice.count,
    options: choice.options,
    level: choice.level,
    linkedTo: choice.linkedTo,
    dependsOnChoiceId: choice.dependsOnChoiceId,
    dependencyKind: choice.dependencyKind,
    replacementFor: choice.replacementFor,
    note: choice.note,
  });
  const exists = choices.some((entry) => JSON.stringify({
    type: entry.type,
    count: entry.count,
    options: entry.options,
    level: entry.level,
    linkedTo: entry.linkedTo,
    dependsOnChoiceId: entry.dependsOnChoiceId,
    dependencyKind: entry.dependencyKind,
    replacementFor: entry.replacementFor,
    note: entry.note,
  }) === key);
  if (!exists) choices.push(choice);
}

export function detectRecharge(text: string): ParsedFeatUse["recharge"] {
  if (/finish a Short or Long Rest/i.test(text)) return "short_or_long_rest";
  if (/finish a Long Rest/i.test(text)) return "long_rest";
  if (/finish a Short Rest/i.test(text)) return "short_rest";
  return null;
}

export function pushUse(uses: ParsedFeatUse[], use: ParsedFeatUse) {
  const key = JSON.stringify({
    count: use.count,
    countFrom: use.countFrom ?? null,
    ability: use.ability ?? null,
    minimum: use.minimum ?? null,
    recharge: use.recharge ?? null,
    note: use.note,
  });
  const exists = uses.some((entry) => JSON.stringify({
    count: entry.count,
    countFrom: entry.countFrom ?? null,
    ability: entry.ability ?? null,
    minimum: entry.minimum ?? null,
    recharge: entry.recharge ?? null,
    note: entry.note,
  }) === key);
  if (!exists) uses.push(use);
}
