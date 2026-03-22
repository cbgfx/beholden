import {
  ALL_LANGUAGES,
  ALL_SKILLS,
  ALL_TOOLS,
  ARTISAN_TOOLS,
  MUSICAL_INSTRUMENTS,
} from "./proficiencyConstants.js";

const ABILITY_SCORES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"] as const;
const DAMAGE_TYPES = ["Acid", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Poison", "Psychic", "Radiant", "Thunder"] as const;
const WEAPON_MASTERY_KINDS = [
  "Battleaxe", "Blowgun", "Club", "Dagger", "Dart", "Flail", "Glaive", "Greataxe", "Greatclub", "Greatsword",
  "Halberd", "Hand Crossbow", "Handaxe", "Heavy Crossbow", "Javelin", "Lance", "Light Crossbow", "Light Hammer",
  "Longbow", "Longsword", "Mace", "Maul", "Morningstar", "Musket", "Pike", "Pistol", "Quarterstaff", "Rapier",
  "Scimitar", "Shortbow", "Shortsword", "Sickle", "Sling", "Spear", "Trident", "War Pick", "Warhammer", "Whip",
] as const;

export interface ParsedFeatModifier {
  category: string;
  text: string;
  target: string | null;
  value: number | null;
}

export interface ParsedFeatChoice {
  id: string;
  type: "proficiency" | "expertise" | "ability_score" | "spell" | "spell_list" | "weapon_mastery" | "damage_type";
  count: number;
  options: string[] | null;
  anyOf?: string[];
  amount?: number | null;
  level?: number | null;
  linkedTo?: string | null;
  distinct?: boolean;
  note?: string | null;
}

export interface ParsedFeatGrants {
  skills: string[];
  tools: string[];
  languages: string[];
  armor: string[];
  weapons: string[];
  savingThrows: string[];
  spells: string[];
  cantrips: string[];
  abilityIncreases: Record<string, number>;
  bonuses: Array<{ target: string; value: number }>;
}

export interface ParsedFeat {
  category: string | null;
  baseName: string;
  variant: string | null;
  prerequisite: string | null;
  repeatable: boolean;
  source: string | null;
  grants: ParsedFeatGrants;
  choices: ParsedFeatChoice[];
  notes: string[];
  modifierDetails: ParsedFeatModifier[];
}

function uniq(values: string[]): string[] {
  return [...new Set(values)];
}

function cleanFeatText(text: string): { body: string; source: string | null } {
  const sourceMatch = text.match(/(?:^|\n)Source:\s*([^\n]+)\s*$/i);
  const source = sourceMatch?.[1]?.trim() ?? null;
  const body = text.replace(/(?:^|\n)Source:\s*[^\n]+\s*$/i, "").trim();
  return { body, source };
}

function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/g).map((part) => part.trim()).filter(Boolean);
}

function normalizeFeatName(name: string): { category: string | null; baseName: string; variant: string | null } {
  const withoutEdition = name.replace(/\s*\[[^\]]+\]\s*$/u, "").trim();
  const categoryMatch = withoutEdition.match(/^([^:]+):\s*(.+)$/);
  const rawBase = categoryMatch?.[2]?.trim() ?? withoutEdition;
  const variantMatch = rawBase.match(/^(.*)\(([^)]+)\)\s*$/);
  return {
    category: categoryMatch?.[1]?.trim() ?? null,
    baseName: (variantMatch?.[1] ?? rawBase).trim(),
    variant: variantMatch?.[2]?.trim() ?? null,
  };
}

function parseModifier(raw: { category?: string; text?: string } | null | undefined): ParsedFeatModifier | null {
  if (!raw) return null;
  const category = String(raw.category ?? "").trim();
  const text = String(raw.text ?? "").trim();
  if (!text) return null;
  const match = text.match(/^(.+?)\s*\+(-?\d+)$/);
  return {
    category,
    text,
    target: match?.[1]?.trim() ?? null,
    value: match ? Number(match[2]) : null,
  };
}

function sentenceHasChoiceLanguage(text: string): boolean {
  return /choice|choose|one of the following|same list you selected/i.test(text);
}

function findExplicitOptions(text: string, canonical: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return canonical
    .filter((name) => lower.includes(name.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
}

function parseAbilityOptions(text: string): string[] {
  return findExplicitOptions(text, ABILITY_SCORES);
}

function parseDamageTypeOptions(text: string): string[] {
  return findExplicitOptions(text, DAMAGE_TYPES);
}

function parseToolOptions(text: string): string[] {
  return findExplicitOptions(text, ALL_TOOLS);
}

function parseSkillOptions(text: string): string[] {
  return findExplicitOptions(text, ALL_SKILLS);
}

function parseLanguageOptions(text: string): string[] {
  return findExplicitOptions(text, ALL_LANGUAGES);
}

function addIfMissing(list: string[], values: string[]) {
  for (const value of values) {
    if (!list.includes(value)) list.push(value);
  }
}

export function parseFeat(args: {
  name: string;
  text: string;
  prerequisite?: string | null;
  proficiency?: string | null;
  modifiers?: Array<{ category?: string; text?: string }>;
}): ParsedFeat {
  const { category, baseName, variant } = normalizeFeatName(args.name);
  const { body, source } = cleanFeatText(args.text);
  const paragraphs = splitIntoParagraphs(body);
  const repeatable = /Repeatable[:.]/i.test(body);

  const grants: ParsedFeatGrants = {
    skills: [],
    tools: [],
    languages: [],
    armor: [],
    weapons: [],
    savingThrows: args.proficiency ? [args.proficiency] : [],
    spells: [],
    cantrips: [],
    abilityIncreases: {},
    bonuses: [],
  };
  const modifierDetails = (args.modifiers ?? []).map(parseModifier).filter(Boolean) as ParsedFeatModifier[];
  const choices: ParsedFeatChoice[] = [];
  const notes: string[] = [];

  for (const modifier of modifierDetails) {
    if (modifier.category.toLowerCase() === "ability score" && modifier.target && modifier.value != null) {
      grants.abilityIncreases[modifier.target.toLowerCase()] = modifier.value;
    } else if (modifier.category.toLowerCase() === "bonus" && modifier.target && modifier.value != null) {
      grants.bonuses.push({ target: modifier.target.toLowerCase(), value: modifier.value });
    }
  }

  for (const paragraph of paragraphs) {
    if (/^Repeatable\./i.test(paragraph)) continue;

    let match = paragraph.match(/You (?:gain )?learn (\w+) cantrips? of your choice from the ([^.]+?) spell list/i);
    if (match) {
      const count = wordToNumber(match[1] ?? "1");
      const lists = splitList(match[2] ?? "");
      choices.push({
        id: "spell_list_primary",
        type: "spell_list",
        count: 1,
        options: lists,
        note: "Choose the spell list for this feat.",
      });
      choices.push({
        id: "cantrips_primary",
        type: "spell",
        count,
        options: null,
        level: 0,
        linkedTo: "spell_list_primary",
        note: "Choose cantrips from the selected spell list.",
      });
      continue;
    }

    match = paragraph.match(/Choose a level (\d+) spell from the same list you selected/i);
    if (match) {
      choices.push({
        id: `spell_level_${match[1]}`,
        type: "spell",
        count: 1,
        options: null,
        level: Number(match[1]),
        linkedTo: "spell_list_primary",
        note: "Choose a spell from the spell list selected earlier.",
      });
      continue;
    }

    match = paragraph.match(/any combination of (\w+) (skills?|tools?|languages?)(?: or (skills?|tools?|languages?))? of your choice/i);
    if (match) {
      const count = wordToNumber(match[1] ?? "1");
      const anyOf = [match[2], match[3]]
        .filter(Boolean)
        .map((value) => normalizeChoiceDomain(String(value)));
      choices.push({
        id: `proficiency_any_${choices.length + 1}`,
        type: "proficiency",
        count,
        options: null,
        anyOf,
        note: "Choose any combination from the allowed proficiency types.",
      });
      continue;
    }

    match = paragraph.match(/proficiency with (\w+) different Artisan'?s Tools of your choice/i);
    if (match) {
      choices.push({
        id: `artisan_tools_${choices.length + 1}`,
        type: "proficiency",
        count: wordToNumber(match[1] ?? "1"),
        options: [...ARTISAN_TOOLS],
        anyOf: ["tool"],
        distinct: true,
      });
      continue;
    }

    match = paragraph.match(/proficiency with (\w+) Musical Instruments? of your choice/i);
    if (match) {
      choices.push({
        id: `musical_instruments_${choices.length + 1}`,
        type: "proficiency",
        count: wordToNumber(match[1] ?? "1"),
        options: [...MUSICAL_INSTRUMENTS],
        anyOf: ["tool"],
        distinct: true,
      });
      continue;
    }

    match = paragraph.match(/proficiency (?:with|in) (\w+|a|an) (skill|tool|language) of your choice/i);
    if (match) {
      const domain = normalizeChoiceDomain(match[2] ?? "");
      const options =
        domain === "skill" ? [...ALL_SKILLS]
        : domain === "language" ? [...ALL_LANGUAGES]
        : [...ALL_TOOLS];
      choices.push({
        id: `${domain}_${choices.length + 1}`,
        type: "proficiency",
        count: wordToNumber(match[1] ?? "1"),
        options,
        anyOf: [domain],
      });
      continue;
    }

    match = paragraph.match(/Choose one skill in which you have proficiency/i);
    if (match) {
      choices.push({
        id: `expertise_${choices.length + 1}`,
        type: "expertise",
        count: 1,
        options: [...ALL_SKILLS],
        note: "Choose a skill you are already proficient in.",
      });
      continue;
    }

    match = paragraph.match(/learn one language of your choice/i);
    if (match) {
      choices.push({
        id: `language_${choices.length + 1}`,
        type: "proficiency",
        count: 1,
        options: [...ALL_LANGUAGES],
        anyOf: ["language"],
      });
      continue;
    }

    match = paragraph.match(/(?:gain proficiency in|choose) one of the following skills?[:.] ([^.]+)/i);
    if (match) {
      choices.push({
        id: `skill_${choices.length + 1}`,
        type: "proficiency",
        count: 1,
        options: parseSkillOptions(match[1] ?? ""),
        anyOf: ["skill"],
      });
      continue;
    }

    match = paragraph.match(/Choose one level (\d+) spell from the ([^.]+?) spell list/i);
    if (match) {
      choices.push({
        id: `spell_list_pick_${choices.length + 1}`,
        type: "spell",
        count: 1,
        options: splitList(match[2] ?? ""),
        level: Number(match[1] ?? "1"),
        note: "Choose a spell from one of the listed spell lists.",
      });
      continue;
    }

    match = paragraph.match(/Choose a level (\d+) or lower spell from the ([^.]+?) spell list/i);
    if (match) {
      choices.push({
        id: `spell_list_pick_${choices.length + 1}`,
        type: "spell",
        count: 1,
        options: splitList(match[2] ?? ""),
        level: Number(match[1] ?? "1"),
        note: "Choose a spell from one of the listed spell lists at or below the stated level.",
      });
      continue;
    }

    match = paragraph.match(/Choose one level (\d+) spell from the ([^.]+?) school of magic/i);
    if (match) {
      choices.push({
        id: `spell_school_${choices.length + 1}`,
        type: "spell",
        count: 1,
        options: splitList(match[2] ?? ""),
        level: Number(match[1] ?? "1"),
        note: "Choose a spell from one of the listed schools of magic.",
      });
      continue;
    }

    match = paragraph.match(/Choose one of the following damage types?[:.] ([^.]+)/i);
    if (match) {
      choices.push({
        id: `damage_${choices.length + 1}`,
        type: "damage_type",
        count: 1,
        options: parseDamageTypeOptions(match[1] ?? ""),
      });
      continue;
    }

    match = paragraph.match(/Increase one ability score of your choice by (\d+)/i);
    if (match) {
      choices.push({
        id: `ability_${choices.length + 1}`,
        type: "ability_score",
        count: 1,
        options: [...ABILITY_SCORES],
        amount: Number(match[1] ?? "1"),
      });
      continue;
    }

    match = paragraph.match(/increase two ability scores of your choice by (\d+)/i);
    if (match) {
      choices.push({
        id: `ability_pair_${choices.length + 1}`,
        type: "ability_score",
        count: 2,
        options: [...ABILITY_SCORES],
        amount: Number(match[1] ?? "1"),
        distinct: true,
      });
      continue;
    }

    match = paragraph.match(/Increase your ([^.]+?) score by (\d+)/i);
    if (match) {
      const options = parseAbilityOptions(match[1] ?? "");
      if (options.length > 1) {
        choices.push({
          id: `ability_specific_${choices.length + 1}`,
          type: "ability_score",
          count: 1,
          options,
          amount: Number(match[2] ?? "1"),
        });
        continue;
      }
    }

    if (/mastery property of one kind of (?:Simple or )?Martial weapon of your choice/i.test(paragraph)) {
      choices.push({
        id: `weapon_mastery_${choices.length + 1}`,
        type: "weapon_mastery",
        count: 1,
        options: [...WEAPON_MASTERY_KINDS],
      });
      continue;
    }

    if (/you (?:gain|have) proficiency/i.test(paragraph) && !sentenceHasChoiceLanguage(paragraph)) {
      addIfMissing(grants.skills, parseSkillOptions(paragraph));
      addIfMissing(grants.tools, parseToolOptions(paragraph));
      addIfMissing(grants.languages, parseLanguageOptions(paragraph));
      if (/Heavy armor/i.test(paragraph)) addIfMissing(grants.armor, ["Heavy Armor"]);
      if (/Medium armor/i.test(paragraph)) addIfMissing(grants.armor, ["Medium Armor"]);
      if (/Light armor/i.test(paragraph)) addIfMissing(grants.armor, ["Light Armor"]);
      if (/Shield/i.test(paragraph)) addIfMissing(grants.armor, ["Shield"]);
      if (/Martial Weapons?/i.test(paragraph)) addIfMissing(grants.weapons, ["Martial Weapons"]);
      if (/Simple Weapons?/i.test(paragraph)) addIfMissing(grants.weapons, ["Simple Weapons"]);
      if (/improvised weapons?/i.test(paragraph)) addIfMissing(grants.weapons, ["Improvised Weapons"]);
      continue;
    }

    if (/You know/i.test(paragraph) && !sentenceHasChoiceLanguage(paragraph)) {
      addIfMissing(grants.languages, parseLanguageOptions(paragraph));
    }

    match = paragraph.match(/You learn the ([A-Z][A-Za-z' -]+?) spell/i);
    if (match && !sentenceHasChoiceLanguage(paragraph)) {
      const spellName = match[1]?.trim();
      if (spellName) addIfMissing(grants.cantrips, [spellName]);
    }

    match = paragraph.match(/You always have the ([A-Z][A-Za-z' -]+?) spell prepared/i);
    if (match && !sentenceHasChoiceLanguage(paragraph)) {
      const spellName = match[1]?.trim();
      if (spellName) addIfMissing(grants.spells, [spellName]);
    }
  }

  if (choices.length === 0 && repeatable) {
    notes.push("Repeatable feat with no explicit structured choice parsed.");
  }

  return {
    category,
    baseName,
    variant,
    prerequisite: args.prerequisite?.trim() || null,
    repeatable,
    source,
    grants: {
      ...grants,
      skills: uniq(grants.skills),
      tools: uniq(grants.tools),
      languages: uniq(grants.languages),
      armor: uniq(grants.armor),
      weapons: uniq(grants.weapons),
      savingThrows: uniq(grants.savingThrows),
      spells: uniq(grants.spells),
      cantrips: uniq(grants.cantrips),
    },
    choices,
    notes,
    modifierDetails,
  };
}

function splitList(text: string): string[] {
  return text
    .replace(/\band\b/gi, ",")
    .replace(/\bor\b/gi, ",")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function wordToNumber(value: string): number {
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

function normalizeChoiceDomain(value: string): string {
  const lowered = value.toLowerCase();
  if (lowered.startsWith("skill")) return "skill";
  if (lowered.startsWith("tool")) return "tool";
  if (lowered.startsWith("language")) return "language";
  return lowered;
}
