import {
  ALL_LANGUAGES,
  ALL_SKILLS,
  ALL_TOOLS,
  ARTISAN_TOOLS,
  MUSICAL_INSTRUMENTS,
} from "./proficiencyConstants.js";
import {
  parsePreparedSpellProgression,
} from "./preparedSpellProgression.js";
import {
  ABILITY_SCORES,
  WEAPON_MASTERY_KINDS,
  addIfMissing,
  detectRecharge,
  normalizeChoiceDomain,
  parseAbilityOptions,
  parseDamageTypeOptions,
  parseLanguageOptions,
  parseSkillOptions,
  parseToolOptions,
  parseWeaponProficiencyGrants,
  pushChoice,
  pushUse,
  splitSentences,
  uniq,
  wordToNumber,
} from "./featParserSupport.js";
import { addNamedSpellGrants, parseSpellListChoiceParagraph, pushSpellChoice } from "./featParserSpells.js";
import { withFeatResolution } from "./featResolution.js";

export type {
  ParsedFeat,
  ParsedFeatChoice,
  ParsedFeatGrants,
  ParsedFeatModifier,
  ParsedFeatUse,
} from "./featParserTypes.js";
import type { ParsedFeat, ParsedFeatChoice, ParsedFeatGrants, ParsedFeatModifier, ParsedFeatUse } from "./featParserTypes.js";

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

  // "a number of [X] equal to your Proficiency Bonus" — X may be "times", "Luck Points", "treats", etc.
  // Exclude dice expressions (d4, d6, d8, …) which indicate rolled counts, not tracked resources.
  match = normalized.match(/\ba number of (?!d\d)(?:[\w][\w' -]* )?equal to your Proficiency Bonus/i);
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

// Feats whose mechanics can't be parsed from text alone (unique reaction/conditional
// mechanics with no generic pattern). These get a NarrativeEffect so downstream UIs
// know not to try to interpret them.
const NARRATIVE_ONLY_FEATS = new Set<string>([
  "Origin: Healer",
  "Origin: Savage Attacker",
  "Origin: Vampire Hunter",
  "Origin: Lords' Alliance Agent",
  "Origin: Tyro of the Gauntlet",
  "Origin: Zhentarim Ruffian",
  "Dragonmark, Potent",
]);

function parseFeatStructuredEffects(
  name: string,
  category: string | null,
  baseName: string,
  body: string,
  grants: ParsedFeatGrants,
): void {
  // ── Fighting Styles ────────────────────────────────────────────────────────
  if (category === "Fighting Style") {
    switch (baseName) {
      case "Archery":
        grants.effects.push({ type: "modifier", target: "attack_roll", mode: "bonus", resolution: "automatic", amount: { kind: "fixed", value: 2 }, gate: { duration: "passive", weaponFilters: ["ranged_weapon"] }, summary: "+2 to attack rolls with Ranged weapons" });
        return;
      case "Blind Fighting": {
        const rangeMatch = body.match(/Blindsight\b.*?(\d+)\s*feet/i);
        const range = rangeMatch ? Number(rangeMatch[1]) : 10;
        grants.effects.push({ type: "senses", mode: "grant", resolution: "automatic", senses: [{ kind: "blindsight", range }], summary: `Blindsight ${range} ft.` });
        return;
      }
      case "Defense":
        grants.effects.push({ type: "armor_class", mode: "bonus", resolution: "automatic", bonus: { kind: "fixed", value: 1 }, gate: { duration: "passive", armorState: "not_unarmored" }, summary: "+1 AC while wearing armor" });
        return;
      case "Dueling":
        grants.effects.push({ type: "modifier", target: "damage_roll", mode: "bonus", resolution: "automatic", amount: { kind: "fixed", value: 2 }, gate: { duration: "passive", weaponFilters: ["melee_weapon", "no_offhand", "no_two_handed"] }, summary: "+2 to damage rolls (melee, one hand, no other weapons)" });
        return;
      case "Great Weapon Fighting":
        grants.effects.push({
          type: "narrative",
          category: "manual_resolution",
          resolution: "manual",
          description: "When rolling damage for a two-handed Melee weapon attack, treat any 1 or 2 on a damage die as a 3. The weapon must have the Two-Handed or Versatile property.",
          summary: "Manual: treat damage-die results of 1 or 2 as 3 with qualifying weapons.",
        });
        return;
      case "Interception":
        grants.effects.push({ type: "action", activation: "reaction", resolution: "manual", description: "When a creature you see hits another creature within 5 ft, reduce that damage by 1d10 + PB (min 0). Requires Shield or weapon.", summary: "Manual reaction: reduce damage to nearby creature by 1d10 + PB." });
        return;
      case "Protection":
        grants.effects.push({ type: "action", activation: "reaction", resolution: "manual", description: "When a creature you see attacks a target within 5 ft of you, impose Disadvantage on that attack roll and all attacks against that target until your next turn. Requires Shield.", summary: "Manual reaction: impose Disadvantage on attacks against nearby ally (requires Shield)." });
        return;
      case "Thrown Weapon Fighting":
        grants.effects.push({ type: "modifier", target: "damage_roll", mode: "bonus", resolution: "automatic", amount: { kind: "fixed", value: 2 }, gate: { duration: "passive", weaponFilters: ["thrown_weapon"] }, summary: "+2 to damage rolls with thrown weapons" });
        return;
      case "Two-Weapon Fighting":
        grants.effects.push({ type: "attack", mode: "add_ability_to_damage", resolution: "automatic", gate: { duration: "passive", weaponFilters: ["light_weapon"], notes: "extra_attack_damage" }, summary: "Add ability modifier to the bonus-action Light-weapon extra attack damage." });
        return;
      case "Unarmed Fighting":
        grants.effects.push({
          type: "attack",
          mode: "damage_die_override",
          resolution: "automatic",
          amount: { kind: "fixed", dice: "1d6" },
          alternateAmount: { kind: "fixed", dice: "1d8" },
          alternateWhen: "no_weapon_or_shield",
          damageType: "bludgeoning",
          gate: { duration: "passive", notes: "unarmed_only" },
          summary: "Unarmed Strikes deal 1d6 + STR, or 1d8 + STR while holding no weapon or Shield.",
        });
        grants.effects.push({
          type: "narrative",
          category: "manual_resolution",
          resolution: "manual",
          description: "At the start of each of your turns, you can deal 1d4 Bludgeoning damage to one creature Grappled by you.",
          summary: "Manual: optional 1d4 damage to one creature Grappled by you at the start of your turn.",
        });
        return;
      default:
        // Unknown fighting style variant: fall through to narrative fallback.
    }
  }

  // ── Origin feats with parseable structure ──────────────────────────────────
  if (category === "Origin") {
    if (baseName === "Alert") {
      grants.effects.push({ type: "proficiency_grant", category: "initiative", resolution: "automatic", summary: "Proficiency in Initiative rolls" });
      grants.effects.push({
        type: "narrative",
        category: "manual_resolution",
        resolution: "manual",
        description: "Immediately after rolling Initiative, you can swap your Initiative with one willing ally in the same combat.",
        summary: "Manual: optionally swap Initiative with a willing ally after rolling.",
      });
      return;
    }
    if (baseName === "Tough") {
      grants.effects.push({ type: "hit_points", mode: "max_bonus", resolution: "automatic", amount: { kind: "character_level", multiplier: 2 }, summary: "+2 HP per character level" });
      return;
    }
  }

  // ── Bespoke feats: mark as manual-resolution narrative ────────────────────
  if (NARRATIVE_ONLY_FEATS.has(name)) {
    grants.effects.push({
      type: "narrative", category: "manual_resolution",
      resolution: "manual",
      description: `${name}: unique mechanics that require bespoke character-sheet handling.`,
      summary: "Manual resolution required.",
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
    effects: [],
  };
  const modifierDetails = (args.modifiers ?? []).map(parseModifier).filter(Boolean) as ParsedFeatModifier[];
  const choices: ParsedFeatChoice[] = [];
  const uses: ParsedFeatUse[] = [];
  const notes: string[] = [];
  let spellcastingAbility: string | null = null;
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
    const fixedSpellcastingAbility = paragraph.match(
      /\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) is your spellcasting ability for (?:it|them|this spell|these spells|the chosen spells)/i,
    );
    if (fixedSpellcastingAbility?.[1]) {
      spellcastingAbility = fixedSpellcastingAbility[1].slice(0, 3).toLowerCase();
    }

    let match: RegExpMatchArray | null = null;

    if (parseSpellListChoiceParagraph(paragraph, choices, grants)) continue;

    match = paragraph.match(/You learn (\w+) ([A-Z][A-Za-z]+) cantrips? of your choice/i);
    if (match) {
      pushSpellChoice(choices, {
        idPrefix: "named_cantrip_choice",
        count: wordToNumber(match[1] ?? "1"),
        options: match[2] ? [match[2]] : null,
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

  parseFeatStructuredEffects(args.name, category, baseName, body, grants);

  const hasAbilityScoreChoice = choices.some((choice) => choice.type === "ability_score");
  if (!hasAbilityScoreChoice) {
    for (const modifier of modifierDetails) {
      if (modifier.category.toLowerCase() === "ability score" && modifier.target && modifier.value != null) {
        grants.abilityIncreases[modifier.target.toLowerCase()] = modifier.value;
      }
    }
  }

  return withFeatResolution(args.name, {
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
    spellcastingAbility,
    spellcastingAbilityFromChoiceId,
  });
}
