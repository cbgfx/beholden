import {
  ALL_LANGUAGES,
  ALL_SKILLS,
  ALL_TOOLS,
  ARTISAN_TOOLS,
  MUSICAL_INSTRUMENTS,
} from "./proficiencyConstants.js";
import {
  parsePreparedSpellProgression,
  type PreparedSpellProgressionTable as ParsedFeatPreparedSpellTable,
} from "./preparedSpellProgression.js";
import {
  ABILITY_SCORES,
  DAMAGE_TYPES,
  KNOWN_CANTRIPS,
  parseAbilityOptions,
  parseDamageTypeOptions,
  parseLanguageOptions,
  parseSkillOptions,
  parseToolOptions,
  parseWeaponProficiencyGrants,
  splitList,
  WEAPON_MASTERY_KINDS,
  wordToNumber,
} from "./featParserSupport.js";

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
  countFrom?: "proficiency_bonus";
  options: string[] | null;
  anyOf?: string[];
  amount?: number | null;
  level?: number | null;
  linkedTo?: string | null;
  dependsOnChoiceId?: string | null;
  dependencyKind?: "spell_list" | "ability_score" | "replacement" | null;
  replacementFor?: string | null;
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

export interface ParsedFeatUse {
  count: number;
  countFrom?: "proficiency_bonus" | "ability_modifier";
  ability?: string | null;
  minimum?: number | null;
  recharge: "short_rest" | "long_rest" | "short_or_long_rest" | null;
  note: string;
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
  uses: ParsedFeatUse[];
  preparedSpellProgression: ParsedFeatPreparedSpellTable[];
  notes: string[];
  modifierDetails: ParsedFeatModifier[];
  spellcastingAbilityFromChoiceId?: string | null;
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

function addIfMissing(list: string[], values: string[]) {
  for (const value of values) {
    if (!list.includes(value)) list.push(value);
  }
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseAbilityIncreaseSentence(
  sentence: string,
  choices: ParsedFeatChoice[],
  grants: ParsedFeatGrants,
): boolean {
  let match = sentence.match(/Increase one ability score of your choice by (\d+)/i)
    ?? sentence.match(/One ability score of your choice increases by (\d+)/i);
  if (match) {
    pushChoice(choices, {
      id: `ability_${choices.length + 1}`,
      type: "ability_score",
      count: 1,
      options: [...ABILITY_SCORES],
      amount: Number(match[1] ?? "1"),
    });
    return true;
  }

  match = sentence.match(/increase two ability scores of your choice by (\d+)/i)
    ?? sentence.match(/Two ability scores of your choice increase by (\d+)/i);
  if (match) {
    pushChoice(choices, {
      id: `ability_pair_${choices.length + 1}`,
      type: "ability_score",
      count: 2,
      options: [...ABILITY_SCORES],
      amount: Number(match[1] ?? "1"),
      distinct: true,
    });
    return true;
  }

  match = sentence.match(/(?:Increase your|Your) ([^.]+?)(?:\s+score|\s+scores)? (?:by (\d+)|increase by (\d+)|increases by (\d+))/i);
  if (match) {
    const amount = Number(match[2] ?? match[3] ?? match[4] ?? "1");
    const options = parseAbilityOptions(match[1] ?? "");
    if (options.length > 1) {
      pushChoice(choices, {
        id: `ability_specific_${choices.length + 1}`,
        type: "ability_score",
        count: 1,
        options,
        amount,
      });
      return true;
    }
    if (options.length === 1) {
      grants.abilityIncreases[options[0]!.toLowerCase()] = amount;
      return true;
    }
  }

  return false;
}

function pushSpellChoice(
  choices: ParsedFeatChoice[],
  args: {
    idPrefix: string;
    count?: number;
    level: number | null;
    options: string[] | null;
    linkedTo?: string | null;
    dependencyKind?: ParsedFeatChoice["dependencyKind"];
    replacementFor?: string | null;
    note: string;
  },
) {
  pushChoice(choices, {
    id: `${args.idPrefix}_${choices.length + 1}`,
    type: "spell",
    count: args.count ?? 1,
    options: args.options,
    level: args.level,
    linkedTo: args.linkedTo ?? null,
    dependsOnChoiceId: args.linkedTo ?? null,
    dependencyKind: args.dependencyKind ?? (args.linkedTo ? "spell_list" : null),
    replacementFor: args.replacementFor ?? null,
    note: args.note,
  });
}

function parseSpellListChoiceParagraph(paragraph: string, choices: ParsedFeatChoice[], grants: ParsedFeatGrants): boolean {
  let match = paragraph.match(/You (?:gain )?learn (\w+) cantrips? of your choice from the ([^.]+?) spell list/i);
  if (match) {
    const count = wordToNumber(match[1] ?? "1");
    const lists = splitList(match[2] ?? "");
    pushChoice(choices, {
      id: "spell_list_primary",
      type: "spell_list",
      count: 1,
      options: lists,
      dependsOnChoiceId: null,
      dependencyKind: null,
      replacementFor: null,
      note: "Choose the spell list for this feat.",
    });
    pushSpellChoice(choices, {
      idPrefix: "cantrips_primary",
      count,
      options: null,
      level: 0,
      linkedTo: "spell_list_primary",
      note: "Choose cantrips from the selected spell list.",
    });
    return true;
  }

  match = paragraph.match(/You know one cantrip of your choice from the ([^.]+?) spell list\.\s*Also, choose a level (\d+) spell from that spell list/i);
  if (match) {
    const lists = splitList(match[1] ?? "");
    pushSpellChoice(choices, {
      idPrefix: "single_cantrip",
      count: 1,
      options: lists,
      level: 0,
      note: "Choose a cantrip from the listed spell list.",
    });
    pushSpellChoice(choices, {
      idPrefix: "spell_from_same_list",
      count: 1,
      options: lists,
      level: Number(match[2] ?? "1"),
      note: "Choose a spell from the same spell list.",
    });
    return true;
  }

  match = paragraph.match(/You learn (\w+) spells? of your choice\.\s*These spells can come from the ([^.]+?) spell list(?:s)? or any combination thereof/i);
  if (match) {
    pushSpellChoice(choices, {
      idPrefix: "spells_from_lists",
      count: wordToNumber(match[1] ?? "1"),
      options: splitList(match[2] ?? ""),
      level: null,
      note: "Choose spells from any of the listed spell lists.",
    });
    return true;
  }

  match = paragraph.match(/(?:You know|You learn) one extra cantrip from the ([^.]+?) spell list/i)
    ?? paragraph.match(/(?:You know|You learn) one cantrip of your choice from the ([^.]+?) spell list/i)
    ?? paragraph.match(/one cantrip from the ([^.]+?) spell list/i);
  if (match) {
    pushSpellChoice(choices, {
      idPrefix: "single_cantrip",
      count: 1,
      options: splitList(match[1] ?? ""),
      level: 0,
      note: "Choose a cantrip from the listed spell list.",
    });
    return true;
  }

  match = paragraph.match(/Choose a level (\d+) spell from the same list you selected/i)
    ?? paragraph.match(/Also, choose a level (\d+) spell from that spell list/i)
    ?? paragraph.match(/You also learn one level (\d+) spell of your choice from that list/i);
  if (match) {
    pushSpellChoice(choices, {
      idPrefix: "spell_from_same_list",
      count: 1,
      options: null,
      level: Number(match[1] ?? "1"),
      linkedTo: "spell_list_primary",
      note: "Choose a spell from the spell list selected earlier.",
    });
    return true;
  }

  match = paragraph.match(/Choose a number of level (\d+) spells equal to your Proficiency Bonus that have the Ritual tag/i);
  if (match) {
    pushChoice(choices, {
      id: `ritual_spells_${choices.length + 1}`,
      type: "spell",
      count: 1,
      countFrom: "proficiency_bonus",
      options: null,
      level: Number(match[1] ?? "1"),
      note: "Choose ritual spells of the stated level. The number of choices equals your Proficiency Bonus.",
    });
    return true;
  }

  match = paragraph.match(/Choose one level (\d+) spell from the ([^.]+?) school of magic\.\s*You always have that spell and the ([A-Z][A-Za-z' -]+?) spell prepared/i);
  if (match) {
    pushSpellChoice(choices, {
      idPrefix: "spell_school",
      count: 1,
      options: splitList(match[2] ?? ""),
      level: Number(match[1] ?? "1"),
      note: "Choose a spell from one of the listed schools of magic.",
    });
    const fixedSpell = match[3]?.trim();
    if (fixedSpell) addIfMissing(grants.spells, [fixedSpell]);
    return true;
  }

  match = paragraph.match(/(?:Choose|learn|know|also learn|one) (?:one )?level (\d+) spell(?: of your choice)? from the ([^.]+?) (spell list|school of magic)/i)
    ?? paragraph.match(/Choose a level (\d+) or lower spell from the ([^.]+?) spell list/i);
  if (match) {
    const level = Number(match[1] ?? "1");
    const domain = (match[3] ?? "spell list").toLowerCase();
    pushSpellChoice(choices, {
      idPrefix: domain.includes("school") ? "spell_school" : "spell_list_pick",
      count: 1,
      options: splitList(match[2] ?? ""),
      level,
      note: domain.includes("school")
        ? "Choose a spell from one of the listed schools of magic."
        : /or lower/i.test(match[0] ?? "")
          ? "Choose a spell from one of the listed spell lists at or below the stated level."
          : "Choose a spell from one of the listed spell lists.",
    });
    return true;
  }

  match = paragraph.match(/If you already know (?:it|that cantrip), you learn a different ([^.]+?) cantrip of your choice/i);
  if (match) {
    pushSpellChoice(choices, {
      idPrefix: "replacement_cantrip",
      count: 1,
      options: null,
      level: 0,
      dependencyKind: "replacement",
      replacementFor: "known_cantrip",
      note: "If you already know the granted cantrip, choose a different cantrip.",
    });
    return true;
  }

  return false;
}

function parseProficiencyChoiceParagraph(paragraph: string, choices: ParsedFeatChoice[]): boolean {
  let match = paragraph.match(/any combination of (\w+) (skills?|tools?|languages?)(?: or (skills?|tools?|languages?))? of your choice/i);
  if (match) {
    const count = wordToNumber(match[1] ?? "1");
    const anyOf = [match[2], match[3]]
      .filter(Boolean)
      .map((value) => normalizeChoiceDomain(String(value)));
    pushChoice(choices, {
      id: `proficiency_any_${choices.length + 1}`,
      type: "proficiency",
      count,
      options: null,
      anyOf,
      note: "Choose any combination from the allowed proficiency types.",
    });
    return true;
  }

  match = paragraph.match(/proficiency with (\w+) different Artisan'?s Tools of your choice/i);
  if (match) {
    pushChoice(choices, {
      id: `artisan_tools_${choices.length + 1}`,
      type: "proficiency",
      count: wordToNumber(match[1] ?? "1"),
      options: [...ARTISAN_TOOLS],
      anyOf: ["tool"],
      distinct: true,
    });
    return true;
  }

  match = paragraph.match(/proficiency with (\w+) Musical Instruments? of your choice/i);
  if (match) {
    pushChoice(choices, {
      id: `musical_instruments_${choices.length + 1}`,
      type: "proficiency",
      count: wordToNumber(match[1] ?? "1"),
      options: [...MUSICAL_INSTRUMENTS],
      anyOf: ["tool"],
      distinct: true,
    });
    return true;
  }

  match = paragraph.match(/proficiency (?:with|in) (\w+|a|an) (skill|tool|language) of your choice/i);
  if (match) {
    const domain = normalizeChoiceDomain(match[2] ?? "");
    const options =
      domain === "skill" ? [...ALL_SKILLS]
        : domain === "language" ? [...ALL_LANGUAGES]
          : [...ALL_TOOLS];
    pushChoice(choices, {
      id: `${domain}_${choices.length + 1}`,
      type: "proficiency",
      count: wordToNumber(match[1] ?? "1"),
      options,
      anyOf: [domain],
    });
    return true;
  }

  match = paragraph.match(/Choose one skill in which you have proficiency/i);
  if (match) {
    pushChoice(choices, {
      id: `expertise_${choices.length + 1}`,
      type: "expertise",
      count: 1,
      options: [...ALL_SKILLS],
      note: "Choose a skill you are already proficient in.",
    });
    return true;
  }

  match = paragraph.match(/learn one language of your choice/i);
  if (match) {
    pushChoice(choices, {
      id: `language_${choices.length + 1}`,
      type: "proficiency",
      count: 1,
      options: [...ALL_LANGUAGES],
      anyOf: ["language"],
    });
    return true;
  }

  match = paragraph.match(/(?:gain proficiency in|choose) one of the following skills?[:.] ([^.]+)/i);
  if (match) {
    pushChoice(choices, {
      id: `skill_${choices.length + 1}`,
      type: "proficiency",
      count: 1,
      options: parseSkillOptions(match[1] ?? ""),
      anyOf: ["skill"],
    });
    return true;
  }

  return false;
}

function extractSpellNames(text: string): string[] {
  const cleaned = text
    .replace(/\bthe\b/gi, "")
    .replace(/\bspells?\b/gi, "")
    .replace(/\bcantrips?\b/gi, "")
    .replace(/\bprepared\b/gi, "")
    .replace(/[().:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];
  return uniq(
    cleaned
      .replace(/\band\/or\b/gi, ",")
      .replace(/\band\b/gi, ",")
      .replace(/\bor\b/gi, ",")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => /^[A-Z][A-Za-z' -]+$/.test(part))
  );
}

function isKnownCantrip(name: string): boolean {
  return KNOWN_CANTRIPS.some((cantrip) => cantrip.toLowerCase() === name.toLowerCase());
}

function addNamedSpellGrants(paragraph: string, grants: ParsedFeatGrants) {
  for (const sentence of splitSentences(paragraph)) {
    let match = sentence.match(/You (?:learn|know) the ([A-Z][A-Za-z' -]+?) spell/i);
    if (match) {
      const spellName = match[1]?.trim();
      if (spellName) {
        if (/\bcantrip\b/i.test(sentence) || isKnownCantrip(spellName)) addIfMissing(grants.cantrips, [spellName]);
        else addIfMissing(grants.spells, [spellName]);
      }
      continue;
    }

    match = sentence.match(/You always have (.+?) spells? prepared/i);
    if (match) {
      const text = String(match[1] ?? "").replace(/\bthat spell\b/gi, "").trim();
      addIfMissing(grants.spells, extractSpellNames(text));
      continue;
    }

    match = sentence.match(/You can cast (.+?) spells? but only as Rituals/i);
    if (match) {
      addIfMissing(grants.spells, extractSpellNames(match[1] ?? ""));
      continue;
    }

    match = sentence.match(/You can cast the ([A-Z][A-Za-z' -]+?) spell but only as a Ritual/i);
    if (match) {
      addIfMissing(grants.spells, [match[1]!.trim()]);
      continue;
    }

    match = sentence.match(/(?:You know|You learn) ([A-Z][A-Za-z' -]+?)\.?$/i);
    if (match) {
      const spellName = match[1]?.trim();
      if (spellName && isKnownCantrip(spellName)) addIfMissing(grants.cantrips, [spellName]);
    }
  }
}

function addFeatNotes(paragraph: string, notes: string[]) {
  const normalized = paragraph.replace(/\s+/g, " ").trim();
  if (!normalized) return;

  if (/spellcasting ability for (?:this spell|the spell|it|them|the spells) is/i.test(normalized) || /is your spellcasting ability for (?:this spell|the spell|it|them|the spells)/i.test(normalized)) {
    const abilitySentence = splitSentences(normalized).find((sentence) => /spellcasting ability/i.test(sentence));
    if (abilitySentence && !notes.includes(abilitySentence)) notes.push(abilitySentence);
  }

  if (/without expending a spell slot/i.test(normalized) || /without a spell slot/i.test(normalized)) {
    const freeCastSentence = splitSentences(normalized).find((sentence) => /without expending a spell slot|without a spell slot/i.test(sentence));
    if (freeCastSentence && !notes.includes(freeCastSentence)) notes.push(freeCastSentence);
  }

  if (/finish a (?:Short or )?Long Rest/i.test(normalized) || /finish a Short or Long Rest/i.test(normalized)) {
    const recoverySentence = splitSentences(normalized).find((sentence) => /finish a (?:Short or )?Long Rest|finish a Short or Long Rest/i.test(sentence));
    if (recoverySentence && !notes.includes(recoverySentence)) notes.push(recoverySentence);
  }
}

function pushChoice(choices: ParsedFeatChoice[], choice: ParsedFeatChoice) {
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

function detectRecharge(text: string): ParsedFeatUse["recharge"] {
  if (/finish a Short or Long Rest/i.test(text)) return "short_or_long_rest";
  if (/finish a Long Rest/i.test(text)) return "long_rest";
  if (/finish a Short Rest/i.test(text)) return "short_rest";
  return null;
}

function pushUse(uses: ParsedFeatUse[], use: ParsedFeatUse) {
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

function parseUsageScaling(paragraph: string, uses: ParsedFeatUse[]) {
  const normalized = paragraph.replace(/\s+/g, " ").trim();
  if (!normalized) return;

  const recharge = detectRecharge(normalized);

  let match = normalized.match(/a number of times equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier \(minimum of (?:once|(\d+))\)/i);
  if (match) {
    pushUse(uses, {
      count: 1,
      countFrom: "ability_modifier",
      ability: match[1]?.toLowerCase() ?? null,
      minimum: match[2] ? Number(match[2]) : 1,
      recharge,
      note: match[0],
    });
  }

  match = normalized.match(/a number of times equal to your Proficiency Bonus/i);
  if (match) {
    pushUse(uses, {
      count: 1,
      countFrom: "proficiency_bonus",
      ability: null,
      minimum: null,
      recharge,
      note: match[0],
    });
  }

  match = normalized.match(/can cast .*? once without (?:expending )?a spell slot/i);
  if (match) {
    pushUse(uses, {
      count: 1,
      recharge,
      note: match[0],
    });
  }

  match = normalized.match(/can cast .*? twice without expending a spell slot/i);
  if (match) {
    pushUse(uses, {
      count: 2,
      recharge,
      note: match[0],
    });
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
  const preparedSpellProgression = parsePreparedSpellProgression(body);
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
  const uses: ParsedFeatUse[] = [];
  const notes: string[] = [];
  let spellcastingAbilityFromChoiceId: string | null = null;

  for (const modifier of modifierDetails) {
    if (modifier.category.toLowerCase() === "bonus" && modifier.target && modifier.value != null) {
      grants.bonuses.push({ target: modifier.target.toLowerCase(), value: modifier.value });
    }
  }

  for (const paragraph of paragraphs) {
    if (/^Repeatable[.:]/i.test(paragraph)) continue;
    addNamedSpellGrants(paragraph, grants);
    addFeatNotes(paragraph, notes);
    parseUsageScaling(paragraph, uses);

    if (/spell'?s spellcasting ability is the ability increased by this feat/i.test(paragraph)) {
      spellcastingAbilityFromChoiceId = choices.find((choice) => choice.type === "ability_score")?.id ?? spellcastingAbilityFromChoiceId;
    }

    let match: RegExpMatchArray | null = null;

    if (parseSpellListChoiceParagraph(paragraph, choices, grants)) continue;

    match = paragraph.match(/You learn (\w+) [A-Z][A-Za-z]+ cantrips? of your choice/i);
    if (match) {
      pushSpellChoice(choices, {
        idPrefix: "named_cantrip_choice",
        count: wordToNumber(match[1] ?? "1"),
        options: null,
        level: 0,
        note: "Choose cantrips granted by this feat.",
      });
      continue;
    }

    if (parseProficiencyChoiceParagraph(paragraph, choices)) continue;

    match = paragraph.match(/Choose one of the following damage types?[:.] ([^.]+)/i);
    if (match) {
      pushChoice(choices, {
        id: `damage_${choices.length + 1}`,
        type: "damage_type",
        count: 1,
        options: parseDamageTypeOptions(match[1] ?? ""),
      });
      continue;
    }

    if (splitSentences(paragraph).some((sentence) => parseAbilityIncreaseSentence(sentence, choices, grants))) {
      continue;
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
      addIfMissing(grants.weapons, parseWeaponProficiencyGrants(paragraph));
      continue;
    }

    if (/You know/i.test(paragraph) && !sentenceHasChoiceLanguage(paragraph)) {
      addIfMissing(grants.languages, parseLanguageOptions(paragraph));
    }

  }

  if (choices.length === 0 && repeatable) {
    notes.push("Repeatable feat with no explicit structured choice parsed.");
  }

  const hasAbilityScoreChoice = choices.some((choice) => choice.type === "ability_score");
  if (!hasAbilityScoreChoice) {
    for (const modifier of modifierDetails) {
      if (modifier.category.toLowerCase() === "ability score" && modifier.target && modifier.value != null) {
        grants.abilityIncreases[modifier.target.toLowerCase()] = modifier.value;
      }
    }
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
    uses,
    preparedSpellProgression,
    notes,
    modifierDetails,
    spellcastingAbilityFromChoiceId,
  };
}

function normalizeChoiceDomain(value: string): string {
  const lowered = value.toLowerCase();
  if (lowered.startsWith("skill")) return "skill";
  if (lowered.startsWith("tool")) return "tool";
  if (lowered.startsWith("language")) return "language";
  return lowered;
}
