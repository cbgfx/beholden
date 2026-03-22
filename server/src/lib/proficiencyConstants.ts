/**
 * Canonical 5e proficiency name lists used for structured parsing of
 * background / race / class XML trait text.
 *
 * Names are stored in "display" casing (title-case).  The matcher
 * always compares lower-case so casing in source XML doesn't matter.
 */

import { parseFeat, type ParsedFeat } from "./featParser.js";

export const ALL_SKILLS = [
  "Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception",
  "History", "Insight", "Intimidation", "Investigation", "Medicine",
  "Nature", "Perception", "Performance", "Persuasion", "Religion",
  "Sleight of Hand", "Stealth", "Survival",
];

export const ARTISAN_TOOLS = [
  "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies",
  "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools",
  "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools",
  "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies",
  "Potter's Tools", "Smith's Tools", "Tinker's Tools",
  "Weaver's Tools", "Woodcarver's Tools",
];

export const GAMING_SETS = [
  "Dice Set", "Dragonchess Set", "Playing Card Set", "Three-Dragon Ante Set",
];

export const MUSICAL_INSTRUMENTS = [
  "Bagpipes", "Drum", "Dulcimer", "Flute", "Lute", "Lyre",
  "Horn", "Pan Flute", "Shawm", "Viol",
];

export const ALL_TOOLS = [
  ...ARTISAN_TOOLS,
  "Disguise Kit", "Forgery Kit", "Herbalism Kit", "Navigator's Tools",
  "Poisoner's Kit", "Thieves' Tools",
  ...GAMING_SETS,
  ...MUSICAL_INSTRUMENTS,
  "Land Vehicles", "Water Vehicles", "Sea Vehicles",
];

export const ALL_LANGUAGES = [
  "Common", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin",
  "Halfling", "Orcish", "Orc",
  "Abyssal", "Celestial", "Draconic", "Deep Speech", "Infernal",
  "Primordial", "Sylvan", "Undercommon",
  "Sign Language", "Thieves' Cant",
];

// Category keyword → canonical list mapping for trait-name parsing
const CATEGORY_MAP: { pattern: RegExp; list: string[] }[] = [
  { pattern: /gaming\s+set/i,           list: GAMING_SETS },
  { pattern: /musical\s+instrument/i,   list: MUSICAL_INSTRUMENTS },
  { pattern: /artisan'?s?\s+tool/i,     list: ARTISAN_TOOLS },
];

// ── Structured proficiency result ────────────────────────────────────────────

export interface ProficiencyChoice {
  fixed: string[];
  choose: number;
  from: string[] | null;  // null = "any from canonical list"
}

export interface StructuredBgProficiencies {
  skills: ProficiencyChoice;
  tools: ProficiencyChoice;
  languages: ProficiencyChoice;
  feats: Array<{ name: string; parsed: ParsedFeat }>;
  abilityScores: string[];   // the 3 ability scores player can choose from
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/** Find canonical names that appear in text, longest-match first. */
function findNamesIn(text: string, names: string[]): string[] {
  const lower = text.toLowerCase();
  return names
    .slice()
    .sort((a, b) => b.length - a.length)
    .filter(n => lower.includes(n.toLowerCase()));
}

/** Extract items from a markdown-style table in text (first column, matched against canonical). */
function parseTableItems(text: string, canonical: string[]): string[] {
  const result: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.includes("|")) continue;
    const cell = (line.split("|")[0] ?? "").trim().replace(/^-+$/, "").trim();
    if (!cell || cell.toLowerCase() === "set" || cell.toLowerCase() === "instrument") continue;
    const match = canonical.find(n => n.toLowerCase() === cell.toLowerCase());
    if (match) result.push(match);
  }
  return result;
}

/** "choose N" / "N of your choice" → N, or 0 if not a choice. */
function detectChooseN(text: string): number {
  const wordToNum: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, any: 1, a: 1,
    "1": 1, "2": 2, "3": 3, "4": 4,
  };
  const patterns = [
    /choose\s+(\w+)/i,
    /(\w+)\s+of\s+(?:your|the following)\s+(?:skills?|tools?|languages?|instrument)/i,
    /(\w+)\s+(?:skills?|tools?|languages?)\s+(?:of\s+)?your\s+choice/i,
    /pick\s+(\w+)/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const word = m[1]?.toLowerCase();
      if (word && wordToNum[word] !== undefined) return wordToNum[word];
    }
  }
  return 0;
}

/** Parse a tool or language trait using BOTH the trait name and text. */
function parseToolTrait(traitName: string, traitText: string): ProficiencyChoice {
  // 1. Check trait NAME for "Choose one kind of X" → get category and choose count
  const nameChooseN = detectChooseN(traitName);

  // 2. Check trait NAME for specific named tool (e.g. "Thieves' Tools")
  const nameFixed = findNamesIn(traitName, ALL_TOOLS);

  // 3. If no choice in name and specific tool found → fixed grant
  if (nameChooseN === 0 && nameFixed.length > 0) {
    return { fixed: nameFixed, choose: 0, from: null };
  }

  // 4. Determine the candidate pool:
  //    a) Table rows in text (most specific)
  //    b) Category keyword in trait name (e.g. "Gaming Set" → GAMING_SETS)
  //    c) All tools (fallback)
  const tableItems = parseTableItems(traitText, ALL_TOOLS);

  let pool: string[] | null = null;
  if (tableItems.length > 0) {
    pool = tableItems;
  } else {
    for (const { pattern, list } of CATEGORY_MAP) {
      if (pattern.test(traitName) || pattern.test(traitText)) {
        pool = list;
        break;
      }
    }
  }

  const chooseN = nameChooseN > 0 ? nameChooseN : detectChooseN(traitText);

  if (chooseN > 0) {
    return { fixed: [], choose: chooseN, from: pool };
  }

  // No explicit choice — everything found is fixed
  return { fixed: pool ?? findNamesIn(traitText, ALL_TOOLS), choose: 0, from: null };
}

function parseLangTrait(traitName: string, traitText: string): ProficiencyChoice {
  const nameFixed = findNamesIn(traitName, ALL_LANGUAGES);
  if (nameFixed.length > 0 && detectChooseN(traitName) === 0) {
    return { fixed: nameFixed, choose: 0, from: null };
  }

  const chooseN = detectChooseN(traitName) || detectChooseN(traitText);
  const listInText = findNamesIn(traitText, ALL_LANGUAGES);
  const fixedInText = listInText.filter(n =>
    !traitText.toLowerCase().includes("choose") &&
    !traitText.toLowerCase().includes("of your choice")
  );

  if (chooseN > 0) {
    return { fixed: [], choose: chooseN, from: listInText.length > 0 ? listInText : null };
  }
  return { fixed: fixedInText.length > 0 ? fixedInText : listInText, choose: 0, from: null };
}

// ── Main entry ───────────────────────────────────────────────────────────────

/** Parse a background XML object into fully structured proficiencies. */
export function parseBackgroundProficiencies(bg: {
  proficiency?: unknown;
  trait?: unknown;
}): StructuredBgProficiencies {
  // Skills — clean comma-separated <proficiency> field
  const profText = typeof bg.proficiency === "string" ? bg.proficiency : "";
  const fixedSkills = profText.split(",").map(s => s.trim()).filter(Boolean);

  // Normalise traits array
  const rawTraits = Array.isArray(bg.trait) ? bg.trait : bg.trait ? [bg.trait] : [];
  const traits: { name: string; text: string }[] = (rawTraits as any[]).map(t => ({
    name: (typeof t?.name === "string" ? t.name : String(t?.name ?? "")).trim(),
    text: (typeof t?.text === "string" ? t.text : String(t?.text ?? "")).trim(),
  }));

  // Tool trait — "Tool Proficiency: ..." in name
  const toolTrait = traits.find(t =>
    /tool|instrument|kit|vehicle|gaming|music/i.test(t.name)
  );
  // Language trait
  const langTrait = traits.find(t => /language/i.test(t.name));

  // Feats — "Feat: X" in trait name
  const feats: Array<{ name: string; parsed: ParsedFeat }> = [];
  for (const t of traits) {
    const m = t.name.match(/^Feat:\s*(.+)$/i);
    if (m?.[1]) {
      const featName = m[1].trim();
      feats.push({
        name: featName,
        parsed: parseFeat({ name: featName, text: t.text }),
      });
    }
  }

  // Ability scores — "Ability Scores: Str, Dex, Con" in trait name
  const abilityScores: string[] = [];
  for (const t of traits) {
    const m = t.name.match(/^Ability Scores?:\s*(.+)$/i);
    if (m?.[1]) {
      m[1].split(",").map(s => s.trim()).filter(Boolean).forEach(s => abilityScores.push(s));
    }
  }

  return {
    skills: { fixed: fixedSkills, choose: 0, from: null },
    tools: toolTrait
      ? parseToolTrait(toolTrait.name, toolTrait.text)
      : { fixed: [], choose: 0, from: null },
    languages: langTrait
      ? parseLangTrait(langTrait.name, langTrait.text)
      : { fixed: [], choose: 0, from: null },
    feats,
    abilityScores,
  };
}
