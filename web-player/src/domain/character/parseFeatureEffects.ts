import type { AbilKey, GrantedSpellCast, ResourceCounter, TaggedItem } from "@/views/character/CharacterSheetTypes";
import { normalizeLanguageName, normalizeResourceKey, proficiencyBonus } from "@/views/character/CharacterSheetUtils";
import { ALL_SKILLS } from "@/views/character/CharacterSheetConstants";
import { titleCase as toTitleCase } from "@/lib/format/titleCase";
import {
  createFeatureEffectId,
  type AbilityScoreEffect,
  type ArmorClassEffect,
  type DefenseEffect,
  type HitPointEffect,
  type ModifierEffect,
  type SensesEffect,
  type SpeedEffect,
  type FeatureEffect,
  type FeatureEffectSource,
  type ParsedFeatureEffects,
  type ProficiencyGrantEffect,
  type SpellChoiceEffect,
  type ScalingValue,
  type SpellGrantEffect,
  type AttackEffect,
  type WeaponMasteryEffect,
  type WeaponFilter,
} from "@/domain/character/featureEffects";

export interface ParseFeatureEffectsInput {
  source: FeatureEffectSource;
  text: string;
  suppressStructuredSpellGrants?: boolean;
}

interface ScalingResolutionContext {
  scores?: Partial<Record<AbilKey, number | null>>;
  level?: number | null;
}

interface EffectStateContext {
  raging?: boolean;
  armorState?: "any" | "no_armor" | "not_heavy";
}


function parseWordCount(value: string): number | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  const direct = Number.parseInt(normalized, 10);
  if (Number.isFinite(direct)) return direct;
  const words: Record<string, number> = {
    once: 1,
    one: 1,
    twice: 2,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  return words[normalized] ?? null;
}

function cleanupText(text: string): string {
  return String(text ?? "")
    .replace(/Source:.*$/gim, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSkillName(raw: string): string | null {
  const normalized = raw.trim().replace(/\s+/g, " ").toLowerCase();
  return SKILL_NAME_MAP.get(normalized) ?? null;
}

function splitSkillNames(raw: string): string[] {
  return raw
    .split(/\s*,\s*|\s+and\s+|\s+or\s+/i)
    .map((part) => normalizeSkillName(part))
    .filter((name): name is string => Boolean(name));
}

function hasContextualQualifier(text: string, matchEndIndex: number): boolean {
  const tail = text.slice(matchEndIndex).trimStart().toLowerCase();
  return [
    "against ",
    "made ",
    "to ",
    "where ",
    "when ",
    "during ",
    "as part of ",
    "that rely on ",
    "using ",
    "within ",
  ].some((prefix) => tail.startsWith(prefix));
}

function textUsesRageGate(text: string): boolean {
  return /while your rage is active|while raging/i.test(text);
}

function isBaseRageRulesText(source: FeatureEffectSource, text: string): boolean {
  return /\brage\b/i.test(source.name)
    && /your rage follows the rules below|damage resistance|rage damage|strength advantage/i.test(text);
}

function createRageGate(source: FeatureEffectSource, text: string) {
  return textUsesRageGate(text) || isBaseRageRulesText(source, text)
    ? { duration: "while_raging" as const }
    : undefined;
}

function isEffectActive(effect: FeatureEffect, opts?: EffectStateContext): boolean {
  const duration = effect.gate?.duration;
  if (duration === "while_raging" && !opts?.raging) return false;
  const armorState = effect.gate?.armorState ?? "any";
  if (armorState === "no_armor" && opts?.armorState !== "no_armor") return false;
  if (armorState === "not_heavy" && opts?.armorState !== "not_heavy" && opts?.armorState !== "no_armor") return false;
  return true;
}

const SPELL_LIST_NAMES = ["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"];
const SPELL_SCHOOL_NAMES = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
const SKILL_NAME_MAP = new Map(ALL_SKILLS.map((skill) => [skill.name.toLowerCase(), skill.name]));

interface WeaponLike {
  name?: string | null;
  type?: string | null;
  properties?: string[] | null;
  dmg1?: string | null;
  dmg2?: string | null;
}

function parseSpellLists(text: string): string[] {
  const found = new Set<string>();
  for (const name of SPELL_LIST_NAMES) {
    if (new RegExp(`\\b${name}\\b`, "i").test(text)) found.add(name);
  }
  return Array.from(found);
}

function normalizeBrokenWord(raw: string, candidates: string[]): string | null {
  const compact = raw.replace(/\s+/g, "").toLowerCase();
  for (const candidate of candidates) {
    if (candidate.replace(/\s+/g, "").toLowerCase() === compact) return candidate;
  }
  return null;
}

function parseSpellSchools(text: string): string[] {
  const found = new Set<string>();
  for (const rawPart of text.split(/\s*,\s*|\s+and\s+|\s+or\s+/i)) {
    const normalized = normalizeBrokenWord(rawPart.trim(), SPELL_SCHOOL_NAMES);
    if (normalized) found.add(normalized);
  }
  return Array.from(found);
}

function splitNamedSpellList(raw: string): string[] {
  return raw
    .split(/\s*,\s*|\s+and\s+/i)
    .map((part) => part.trim().replace(/^the\s+/i, ""))
    .filter(Boolean)
    .filter(isLikelySpellName);
}

function hasLikelySpellNameCapitalization(spellName: string): boolean {
  return /[A-Z]/.test(spellName) && spellName !== spellName.toLowerCase();
}

function looksLikePreparedSpellList(raw: string): boolean {
  const cleaned = String(raw ?? "").trim();
  if (!cleaned) return false;
  if (/[.;:!?]/.test(cleaned)) return false;
  if (/\b(count|prepare|prepared spells|whenever|replace|thereafter|otherwise|with this feature|finish a long rest|finish a short rest)\b/i.test(cleaned)) {
    return false;
  }
  return splitNamedSpellList(cleaned).length > 0;
}

function addSpellGrantEffect(
  source: FeatureEffectSource,
  effects: FeatureEffect[],
  args: {
    spellName: string;
    mode: SpellGrantEffect["mode"];
    spellList?: string;
    requiredLevel?: number;
    riderSummary?: string;
    castsWithoutSlot?: boolean;
    uses?: ScalingValue;
    reset?: SpellGrantEffect["reset"];
    noMaterialComponents?: boolean;
    resourceKey?: string;
    summary: string;
  },
) {
  const cleaned = args.spellName.trim().replace(/^the\s+/i, "");
  if (!cleaned || !isLikelySpellName(cleaned)) return;
  effects.push({
    id: createFeatureEffectId(source, "spell_grant", effects.length),
    type: "spell_grant",
    source,
    spellName: cleaned,
    spellList: args.spellList,
    mode: args.mode,
    requiredLevel: args.requiredLevel,
    riderSummary: args.riderSummary,
    castsWithoutSlot: args.castsWithoutSlot,
    uses: args.uses,
    reset: args.reset,
    noMaterialComponents: args.noMaterialComponents,
    resourceKey: args.resourceKey,
    summary: args.summary,
  } satisfies SpellGrantEffect);
}

function hasWeaponProperty(item: WeaponLike | null | undefined, code: string): boolean {
  return (item?.properties ?? []).some((property) => String(property ?? "").trim().toUpperCase() === code.toUpperCase());
}

function isWeaponLike(item: WeaponLike | null | undefined): boolean {
  return Boolean(item?.dmg1 || item?.dmg2) || /weapon/i.test(String(item?.type ?? "")) || /\bstaff\b/i.test(String(item?.type ?? ""));
}

function isMeleeWeaponLike(item: WeaponLike | null | undefined): boolean {
  if (!isWeaponLike(item)) return false;
  return !/ranged/i.test(String(item?.type ?? ""));
}

function isRangedWeaponLike(item: WeaponLike | null | undefined): boolean {
  return /ranged/i.test(String(item?.type ?? ""));
}

function isCrossbowWeaponLike(item: WeaponLike | null | undefined): boolean {
  return /crossbow/i.test(String(item?.name ?? "")) || /crossbow/i.test(String(item?.type ?? ""));
}

function weaponMatchesFilters(item: WeaponLike | null | undefined, filters: WeaponFilter[] | undefined): boolean {
  if (!filters?.length) return false;
  return filters.every((filter) => {
    switch (filter) {
      case "simple_weapon":
        return isWeaponLike(item) && !hasWeaponProperty(item, "M");
      case "martial_weapon":
        return hasWeaponProperty(item, "M");
      case "melee_weapon":
        return isMeleeWeaponLike(item);
      case "ranged_weapon":
        return isRangedWeaponLike(item);
      case "finesse_weapon":
        return hasWeaponProperty(item, "F");
      case "light_weapon":
        return hasWeaponProperty(item, "L");
      case "crossbow_weapon":
        return isCrossbowWeaponLike(item);
      case "light_crossbow":
        return hasWeaponProperty(item, "L") && isCrossbowWeaponLike(item);
      case "no_two_handed":
        return !hasWeaponProperty(item, "2H");
      default:
        return false;
    }
  });
}

function pushSpellChoiceEffect(
  source: FeatureEffectSource,
  effects: FeatureEffect[],
  args: { count: number; level: number; spellLists: string[]; schools?: string[]; note?: string }
) {
  if (args.count <= 0 || args.spellLists.length === 0) return;
  effects.push({
    id: createFeatureEffectId(source, "spell_choice", effects.length),
    type: "spell_choice",
    source,
    mode: "learn",
    count: { kind: "fixed", value: args.count },
    level: args.level,
    spellLists: args.spellLists,
    schools: args.schools,
    note: args.note,
    summary: `Choose ${args.count} ${args.level === 0 ? "cantrip" : `level ${args.level} spell`}${args.count === 1 ? "" : "s"} from ${args.spellLists.join(", ")}`,
  } satisfies SpellChoiceEffect);
}

function isLikelySpellName(spellName: string): boolean {
  const cleaned = spellName.trim().replace(/^the\s+/i, "");
  if (!cleaned) return false;
  if (/[|]/.test(cleaned)) return false;
  if (/^[\d/]+$/.test(cleaned)) return false;
  if (/^(yes|no)$/i.test(cleaned)) return false;
  if (!hasLikelySpellNameCapitalization(spellName)) return false;
  if (/^(it|that|these|those)(?:\s+spell|\s+spells)?$/i.test(cleaned)) return false;
  if (/^(a|an|another)\s+/i.test(cleaned)) return false;
  if (/^(prepared|chosen|listed|extra|one extra)\b/i.test(cleaned)) return false;
  if (/^different\b/i.test(cleaned)) return false;
  if (/^(wizard|cleric|druid|bard|sorcerer|warlock|paladin|ranger|artificer)\b/i.test(cleaned)) return false;
  if (/\bof your choice\b/i.test(cleaned)) return false;
  if (/\bspell list\b/i.test(cleaned)) return false;
  if (/\bfrom the\b/i.test(cleaned)) return false;
  if (/\bcount against\b/i.test(cleaned)) return false;
  if (/\bwith this feature\b/i.test(cleaned)) return false;
  if (/\buntil the number on the table\b/i.test(cleaned)) return false;
  return true;
}

function parseKnownSpellGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const inferredSpellLists = parseSpellLists(text);
  const spellList = inferredSpellLists.length === 1 ? inferredSpellLists[0] : undefined;

  for (const match of text.matchAll(/when you reach character levels?\s+(\d+)\s+and\s+(\d+),\s+you\s+learn\s+([A-Z][A-Za-z' -]+?)\s+and\s+([A-Z][A-Za-z' -]+?)\s+respectively/gi)) {
    const firstLevel = Number(match[1]);
    const secondLevel = Number(match[2]);
    const firstSpell = match[3]?.trim();
    const secondSpell = match[4]?.trim();
    if (!firstSpell || !secondSpell || !Number.isFinite(firstLevel) || !Number.isFinite(secondLevel)) continue;
    addSpellGrantEffect(source, effects, {
      spellName: firstSpell,
      spellList,
      mode: "known",
      requiredLevel: firstLevel,
      summary: `${firstSpell} known spell`,
    });
    addSpellGrantEffect(source, effects, {
      spellName: secondSpell,
      spellList,
      mode: "known",
      requiredLevel: secondLevel,
      summary: `${secondSpell} known spell`,
    });
  }

  for (const match of text.matchAll(/you\s+(?:learn|know)\s+(?:the\s+)?([A-Za-z][A-Za-z' -]+?)\s+cantrip\b/gi)) {
    const spellName = match[1]?.trim();
    if (!spellName) continue;
    addSpellGrantEffect(source, effects, {
      spellName,
      spellList,
      mode: "known",
      summary: `${spellName} known cantrip`,
    });
  }

  for (const match of text.matchAll(/you\s+(?:learn|know)\s+(?:the\s+)?([A-Za-z][A-Za-z' -]+?)\s+spell\b/gi)) {
    const spellName = match[1]?.trim();
    if (!spellName) continue;
    addSpellGrantEffect(source, effects, {
      spellName,
      spellList,
      mode: "known",
      summary: `${spellName} known spell`,
    });
  }
}

function parseAlwaysPreparedSpellGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const inferredSpellLists = parseSpellLists(text);
  const spellList = inferredSpellLists.length === 1 ? inferredSpellLists[0] : undefined;

  const addAlwaysPrepared = (spellName: string, requiredLevel?: number) => {
    addSpellGrantEffect(source, effects, {
      spellName,
      spellList,
      mode: "always_prepared",
      requiredLevel,
      summary: `${spellName.trim().replace(/^the\s+/i, "")} always prepared`,
    });
  };

  for (const match of text.matchAll(/always have\s+(.+?)\s+spells?\s+prepared/gi)) {
    const raw = match[1]?.trim();
    if (!raw || /^(certain|the listed)$/i.test(raw) || !looksLikePreparedSpellList(raw)) continue;
    splitNamedSpellList(raw).forEach(addAlwaysPrepared);
  }

  for (const match of text.matchAll(/when you reach (?:character|cleric|bard|druid|paladin|ranger|sorcerer|warlock|wizard|artificer) level\s+(\d+),?\s+you(?:\s+also)?\s+always have\s+(.+?)\s+spells?\s+prepared/gi)) {
    const requiredLevel = Number(match[1]);
    const raw = match[2]?.trim();
    if (!raw || !Number.isFinite(requiredLevel) || !looksLikePreparedSpellList(raw)) continue;
    splitNamedSpellList(raw).forEach((name) => addAlwaysPrepared(name, requiredLevel));
  }

  if (/always have that spell prepared/i.test(text) || /always have those spells prepared/i.test(text)) {
    effects
      .filter((effect): effect is SpellGrantEffect =>
        effect.type === "spell_grant"
        && effect.mode === "known"
        && !/cantrip/i.test(effect.summary ?? "")
      )
      .forEach((effect) => addAlwaysPrepared(effect.spellName, effect.requiredLevel));
  }

  const tableMatch = text.match(/(?:[A-Za-z' ]+ Spells?)\s*:\s*(?:Spell Level|[A-Za-z]+ Level)\s*\|\s*(?:Prepared\s+)?Spells?\s+(.+)/i);
  if (!/listed spells prepared/i.test(text) || !tableMatch?.[1]) return;

  for (const row of tableMatch[1].matchAll(/(\d+)\s*\|\s*([^|]+?)(?=\s+\d+\s*\||$)/g)) {
    const requiredLevel = Number(row[1]);
    const rawNames = row[2]?.trim();
    if (!rawNames || !Number.isFinite(requiredLevel)) continue;
    rawNames
      .split(/\s*,\s*/)
      .map((name) => name.replace(/\*/g, "").trim())
      .filter(Boolean)
      .forEach((name) => addAlwaysPrepared(name, requiredLevel));
  }
}

function parseExpandedListSpellGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (!/added to (?:that feature's|your) spell list/i.test(text)) return;

  const tableMatch = text.match(/(?:[A-Za-z' ]+ Spells?)\s*:\s*(?:Spell Level|[A-Za-z]+ Level)\s*\|\s*(?:Prepared\s+)?Spells?\s+(.+)/i);
  if (!tableMatch?.[1]) return;

  const rowsText = tableMatch[1];
  for (const row of rowsText.matchAll(/(\d+)\s*\|\s*([^|]+?)(?=\s+\d+\s*\||$)/g)) {
    const requiredLevel = Number(row[1]);
    const rawNames = row[2]?.trim();
    if (!rawNames || !Number.isFinite(requiredLevel)) continue;
    rawNames
      .split(/\s*,\s*/)
      .map((name) => name.replace(/\*/g, "").trim())
      .filter(Boolean)
      .forEach((spellName) => {
        addSpellGrantEffect(source, effects, {
          spellName,
          mode: "expanded_list",
          requiredLevel,
          summary: `${spellName} added to spell list`,
        });
      });
  }
}

function hasSpellGrantEffect(
  effects: FeatureEffect[],
  spellName: string,
  mode: SpellGrantEffect["mode"]
): boolean {
  return effects.some((effect) =>
    effect.type === "spell_grant"
    && effect.mode === mode
    && effect.spellName.trim().toLowerCase() === spellName.trim().toLowerCase()
  );
}

function pushFreeCastSpellEffects(
  source: FeatureEffectSource,
  effects: FeatureEffect[],
  spellNames: string[],
  args: {
    uses: ScalingValue;
    reset: SpellGrantEffect["reset"];
    noMaterialComponents?: boolean;
  }
) {
  for (const spellName of spellNames) {
    if (!spellName || hasSpellGrantEffect(effects, spellName, "free_cast")) continue;
    const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
    addSpellGrantEffect(source, effects, {
      spellName,
      mode: "free_cast",
      uses: args.uses,
      reset: args.reset,
      castsWithoutSlot: true,
      noMaterialComponents: args.noMaterialComponents,
      resourceKey,
      summary: `${spellName} free casts`,
    });
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label: `${spellName} (${source.name})`,
      max: args.uses,
      reset: args.reset ?? "long_rest",
      restoreAmount: "all",
      linkedSpellName: spellName,
      summary: `${spellName} resource pool`,
    });
  }
}

function parseRitualOnlySpellGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  for (const match of text.matchAll(/you can cast\s+(?:the\s+)?(.+?)\s+spells?\s+but only as rituals?\b/gi)) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    const spellNames = splitNamedSpellList(raw);
    for (const spellName of spellNames) {
      if (hasSpellGrantEffect(effects, spellName, "known")) continue;
      addSpellGrantEffect(source, effects, {
        spellName,
        mode: "known",
        riderSummary: "Ritual only. No spell slot required.",
        summary: `${spellName} ritual casting`,
      });
    }
  }
}

function parseSpellGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (!/without expending a spell slot/i.test(text)) return;
  const reset =
    /finish a short or long rest/i.test(text) ? "short_or_long_rest"
    : /finish a short rest/i.test(text) ? "short_rest"
    : /finish a long rest/i.test(text) ? "long_rest"
    : undefined;
  const abilityCountMatch = text.match(/a number of times equal to your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+modifier\s*\(minimum of once\)/i);
  const proficiencyCountMatch = text.match(/a number of times equal to your\s+Proficiency Bonus/i);
  const fixedCountMatch = text.match(/\b(once|twice|one|two|three|four|five|six)\b[^.]*without expending a spell slot/i);
  const noMaterialComponents = /without (?:a |needing )?Material components/i.test(text);
  const preparedSpellNames = effects
    .filter((effect): effect is SpellGrantEffect => effect.type === "spell_grant" && effect.mode === "always_prepared")
    .map((effect) => effect.spellName);
  const uniquePreparedSpellNames = Array.from(new Set(preparedSpellNames));

  const pronounTargetSpellNames =
    /cast (?:it|that spell) without expending a spell slot/i.test(text) && uniquePreparedSpellNames.length > 0 ? uniquePreparedSpellNames.slice(-1)
    : /cast (?:it|that spell) once without expending a spell slot/i.test(text) && uniquePreparedSpellNames.length > 0 ? uniquePreparedSpellNames.slice(-1)
    : [];
  const eachPreparedSpellNames =
    /cast each spell once without (?:expending a spell slot|a spell slot)/i.test(text) ? uniquePreparedSpellNames
    : /cast each of these spells without expending a spell slot/i.test(text) ? uniquePreparedSpellNames
    : /cast either spell without expending a spell slot/i.test(text) ? uniquePreparedSpellNames
    : [];
  const inferredSingleUsePreparedSpellNames =
    reset && eachPreparedSpellNames.length > 0 && (
      /once you cast either spell in this way/i.test(text)
      || /you must finish a (?:Short or Long|Long|Short) Rest before you can cast each spell in this way again/i.test(text)
      || /you can't cast that spell in this way again until you finish a (?:Short or Long|Long|Short) Rest/i.test(text)
    ) ? eachPreparedSpellNames : [];

  if (reset && abilityCountMatch && (pronounTargetSpellNames.length > 0 || eachPreparedSpellNames.length > 0)) {
    const ability = abilityCountMatch[1].trim().toLowerCase().slice(0, 3) as AbilKey;
    const spellNames = eachPreparedSpellNames.length > 0 ? eachPreparedSpellNames : pronounTargetSpellNames;
    pushFreeCastSpellEffects(source, effects, spellNames, {
      uses: { kind: "ability_mod", ability, min: 1 },
      reset,
      noMaterialComponents,
    });
    return;
  }

  if (reset && proficiencyCountMatch && (pronounTargetSpellNames.length > 0 || eachPreparedSpellNames.length > 0)) {
    const spellNames = eachPreparedSpellNames.length > 0 ? eachPreparedSpellNames : pronounTargetSpellNames;
    pushFreeCastSpellEffects(source, effects, spellNames, {
      uses: { kind: "proficiency_bonus" },
      reset,
      noMaterialComponents,
    });
    return;
  }

  if (reset && fixedCountMatch && (pronounTargetSpellNames.length > 0 || eachPreparedSpellNames.length > 0)) {
    const spellNames = eachPreparedSpellNames.length > 0 ? eachPreparedSpellNames : pronounTargetSpellNames;
    pushFreeCastSpellEffects(source, effects, spellNames, {
      uses: { kind: "fixed", value: parseWordCount(fixedCountMatch[1]) ?? 1 },
      reset,
      noMaterialComponents,
    });
    return;
  }

  if (inferredSingleUsePreparedSpellNames.length > 0) {
    pushFreeCastSpellEffects(source, effects, inferredSingleUsePreparedSpellNames, {
      uses: { kind: "fixed", value: 1 },
      reset,
      noMaterialComponents,
    });
    return;
  }

  const spellMatch = text.match(/you can cast\s+([A-Z][A-Za-z' -]+?)\s+without expending a spell slot/i);
  if (!spellMatch) return;

  const spellName = spellMatch[1].replace(/\s+on yourself$/i, "").trim();

  if (abilityCountMatch && reset) {
    const ability = abilityCountMatch[1].trim().toLowerCase().slice(0, 3) as AbilKey;
    const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
    addSpellGrantEffect(source, effects, {
      spellName,
      mode: "free_cast",
      uses: { kind: "ability_mod", ability, min: 1 },
      reset,
      castsWithoutSlot: true,
      noMaterialComponents,
      resourceKey,
      summary: `${spellName} free cast keyed off ${ability.toUpperCase()} modifier`,
    });
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label: `${spellName} (${source.name})`,
      max: { kind: "ability_mod", ability, min: 1 },
      reset,
      restoreAmount: "all",
      linkedSpellName: spellName,
      summary: `${spellName} resource pool`,
    });
    return;
  }

  if (fixedCountMatch && reset) {
    const max = parseWordCount(fixedCountMatch[1]) ?? 1;
    const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
    addSpellGrantEffect(source, effects, {
      spellName,
      mode: "free_cast",
      uses: { kind: "fixed", value: max },
      reset,
      castsWithoutSlot: true,
      noMaterialComponents,
      resourceKey,
      summary: `${spellName} fixed free casts`,
    });
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label: `${spellName} (${source.name})`,
      max: { kind: "fixed", value: max },
      reset,
      restoreAmount: "all",
      linkedSpellName: spellName,
      summary: `${spellName} resource pool`,
    });
    return;
  }

  if (proficiencyCountMatch && reset) {
    const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
    addSpellGrantEffect(source, effects, {
      spellName,
      mode: "free_cast",
      uses: { kind: "proficiency_bonus" },
      reset,
      castsWithoutSlot: true,
      noMaterialComponents,
      resourceKey,
      summary: `${spellName} free casts keyed off Proficiency Bonus`,
    });
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label: `${spellName} (${source.name})`,
      max: { kind: "proficiency_bonus" },
      reset,
      restoreAmount: "all",
      linkedSpellName: spellName,
      summary: `${spellName} resource pool`,
    });
    return;
  }

  addSpellGrantEffect(source, effects, {
    spellName,
    mode: "at_will",
    castsWithoutSlot: true,
    summary: `${spellName} at will`,
  });
}

function parseSpellChoiceEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  let lastSpellLists: string[] = [];

  for (const match of text.matchAll(/choose\s+(\w+)\s+cantrips?,\s+and\s+choose\s+(\w+)\s+level\s+(\d+)\s+spells?\s+that\s+have\s+the\s+ritual\s+tag[^.]*from\s+any\s+class'?s\s+spell\s+list/gi)) {
    const cantripCount = parseWordCount(match[1]) ?? 0;
    const spellCount = parseWordCount(match[2]) ?? 0;
    const spellLevel = Number(match[3]);
    if (cantripCount > 0) {
      pushSpellChoiceEffect(source, effects, {
        count: cantripCount,
        level: 0,
        spellLists: [...SPELL_LIST_NAMES],
        note: "From any class spell list.",
      });
    }
    if (spellCount > 0 && Number.isFinite(spellLevel)) {
      pushSpellChoiceEffect(source, effects, {
        count: spellCount,
        level: spellLevel,
        spellLists: [...SPELL_LIST_NAMES],
        note: "Must have the Ritual tag. From any class spell list.",
      });
    }
  }

  for (const match of text.matchAll(/you\s+(?:know|learn)\s+(\w+)\s+(?:extra\s+)?cantrips?(?:\s+of\s+your\s+choice)?\s+from\s+the\s+([^.]+?)\s+spell\s+list/gi)) {
    const count = parseWordCount(match[1]) ?? 0;
    const spellLists = parseSpellLists(match[2]);
    if (spellLists.length === 0) continue;
    lastSpellLists = spellLists;
    pushSpellChoiceEffect(source, effects, { count, level: 0, spellLists });
  }

  for (const match of text.matchAll(/you\s+(?:also\s+)?learn\s+(\w+)\s+level\s+(\d+)\s+spells?(?:\s+of\s+your\s+choice)?\s+from\s+(?:the\s+([^.]+?)\s+spell\s+list|that\s+list)/gi)) {
    const count = parseWordCount(match[1]) ?? 0;
    const level = Number(match[2]);
    const spellLists = match[3] ? parseSpellLists(match[3]) : lastSpellLists;
    if (!Number.isFinite(level) || spellLists.length === 0) continue;
    if (match[3]) lastSpellLists = spellLists;
    pushSpellChoiceEffect(source, effects, { count, level, spellLists });
  }

  for (const match of text.matchAll(/choose\s+(\w+)\s+([A-Z][A-Za-z]+)\s+spells?\s+from\s+the\s+([A-Za-z\s,]+?)\s+school(?:s)?(?:\s+of\s+magic)?,\s+each of which must be no higher than level\s+(\d+)/gi)) {
    const count = parseWordCount(match[1]) ?? 0;
    const spellLists = parseSpellLists(match[2]);
    const schools = parseSpellSchools(match[3]);
    const level = Number(match[4]);
    if (!Number.isFinite(level) || spellLists.length === 0 || schools.length === 0 || count <= 0) continue;
    pushSpellChoiceEffect(source, effects, {
      count,
      level,
      spellLists,
      schools,
      note: "At or below the listed level.",
    });
  }

  for (const match of text.matchAll(/if you already know (?:it|that cantrip), you learn a different ([A-Z][A-Za-z]+) cantrip of your choice/gi)) {
    const spellLists = parseSpellLists(match[1]);
    if (spellLists.length === 0) continue;
    pushSpellChoiceEffect(source, effects, {
      count: 1,
      level: 0,
      spellLists,
      note: "Replacement cantrip if you already know the named cantrip.",
    });
  }

}

function parseResourceGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const reset =
    /finish a short or long rest/i.test(text) ? "short_or_long_rest"
    : /finish a short rest/i.test(text) ? "short_rest"
    : /finish a long rest/i.test(text) ? "long_rest"
    : undefined;

  for (const match of text.matchAll(/you have a number of ([A-Z][A-Za-z' -]+?) equal to your Proficiency Bonus/gi)) {
    const label = match[1]?.trim();
    if (!label || !reset) continue;

    const hasSpendLanguage = new RegExp(`spend (?:the )?${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text)
      || /spend the points/i.test(text);
    const hasRegainLanguage =
      new RegExp(`regain your expended ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text)
      || /regain your expended points/i.test(text);
    if (!hasSpendLanguage || !hasRegainLanguage) continue;

    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey: normalizeResourceKey(`${source.name}:${label}`),
      label,
      max: { kind: "proficiency_bonus" },
      reset,
      restoreAmount: "all",
      summary: `${label} equal to your Proficiency Bonus`,
    });
  }

  const sourceLabel = String(source.name ?? "").replace(/^Level\s+\d+\s*:\s*/i, "").trim();
  const escapedLabel = sourceLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fixedUseMatch = text.match(new RegExp(`you can use (?:the )?(?:${escapedLabel}|this feature)\\s+(once|twice|one|two|three|four|five|six|\\d+)`, "i"));
  const fixedUses = parseWordCount(fixedUseMatch?.[1] ?? "");
  const regainsOneOnShort = /regain one expended use when you finish a short rest/i.test(text);
  const regainsAllOnLong = /regain all expended uses when you finish a long rest/i.test(text);
  const regainsAllOnShortOrLong = /regain all expended uses when you finish a short or long rest/i.test(text);
  const regainsAllOnShort = /regain all expended uses when you finish a short rest/i.test(text);
  const regainsAllOnRest =
    regainsAllOnShortOrLong ? "short_or_long_rest"
    : regainsAllOnShort ? "short_rest"
    : regainsAllOnLong ? "long_rest"
    : null;

  if (sourceLabel && fixedUses && (regainsOneOnShort || regainsAllOnRest)) {
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey: normalizeResourceKey(sourceLabel),
      label: sourceLabel,
      max: { kind: "fixed", value: fixedUses },
      reset: regainsOneOnShort ? "short_rest" : regainsAllOnRest!,
      restoreAmount: regainsOneOnShort ? "one" : "all",
      summary: `${sourceLabel} uses`,
    });
  }

  // Pattern: "you can use this feature/trait/benefit/ability a number of times equal to your Proficiency Bonus"
  // Covers species traits, feat abilities, class features not using "you have a number of X" phrasing.
  // Matches: "this feature", "this trait", "this benefit", "this ability", "this Breath Weapon", "the Vigilant Guardian", etc.
  const pbUsesRe = new RegExp(
    `you can use (?:this\\s+(?:feature|trait|benefit|ability)|(?:(?:this|the)\\s+)?${escapedLabel})\\s+a\\s+number of times equal to your Proficiency Bonus`,
    "i",
  );
  const hasPbUsesLanguage = sourceLabel && pbUsesRe.test(text);
  if (hasPbUsesLanguage && (regainsOneOnShort || regainsAllOnRest)) {
    // Don't double-emit if the PB branch above already produced an effect for this sourceLabel.
    const alreadyEmitted = effects.some(
      (e) => e.type === "resource_grant" && e.source === source && (e as { resourceKey?: string }).resourceKey === normalizeResourceKey(sourceLabel),
    );
    if (!alreadyEmitted) {
      effects.push({
        id: createFeatureEffectId(source, "resource_grant", effects.length),
        type: "resource_grant",
        source,
        resourceKey: normalizeResourceKey(sourceLabel),
        label: sourceLabel,
        max: { kind: "proficiency_bonus" },
        reset: regainsOneOnShort ? "short_rest" : regainsAllOnRest!,
        restoreAmount: regainsOneOnShort ? "one" : "all",
        summary: `${sourceLabel} uses (PB)`,
      });
    }
  }
}

function parseProficiencyGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const armor: string[] = [];
  const weapons: string[] = [];
  const tools: string[] = [];
  const skills: string[] = [];
  const expertise: string[] = [];
  const saves: string[] = [];
  const languages = new Set<string>();

  const pushArmorGrant = (raw: string) => {
    const normalized = String(raw ?? "").trim().toLowerCase();
    if (!normalized) return;
    if (/\ball\b/.test(normalized)) {
      armor.push("All Armor");
      return;
    }
    if (/\blight\b/.test(normalized)) armor.push("Light Armor");
    if (/\bmedium\b/.test(normalized)) armor.push("Medium Armor");
    if (/\bheavy\b/.test(normalized)) armor.push("Heavy Armor");
  };

  const armorClauseRe = /(?:armor training:\s*|training with\s+|proficiency with\s+)((?:all|light|medium|heavy)(?:[\w\s,]*?(?:armor|shields?))?)/gi;
  let m: RegExpExecArray | null;
  while ((m = armorClauseRe.exec(text)) !== null) {
    const clause = m[1]?.trim();
    if (!clause) continue;
    pushArmorGrant(clause);
    if (/\bshields?\b/i.test(clause)) armor.push("Shields");
  }

  for (const match of text.matchAll(/(?:armor training:\s*|training with\s+|proficiency with\s+)shields?\b/gi)) {
    if (match[0]) armor.push("Shields");
  }

  const weaponRe = /proficiency with\s+([\w\s,]+?)\s+weapons\b/gi;
  while ((m = weaponRe.exec(text)) !== null) {
    m[1]
      .split(/\s+and\s+|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => weapons.push(`${toTitleCase(s)} Weapons`));
  }

  const toolRe = /proficiency with\s+([\w\s']+?(?:tools?|kit|instruments?|supplies))\b/gi;
  while ((m = toolRe.exec(text)) !== null) {
    tools.push(toTitleCase(m[1].trim()));
  }

  const skillRe = /proficiency in\s+([\w\s]+?)(?:\.|,|\band\b|$)/gi;
  while ((m = skillRe.exec(text)) !== null) {
    skills.push(toTitleCase(m[1].trim()));
  }

  for (const match of text.matchAll(/proficiency (?:with|in)\s+([A-Za-z,\s]+?)\s+saving throws?/gi)) {
    match[1]
      .split(/\s+and\s+|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((name) => saves.push(toTitleCase(name)));
  }

  for (const match of text.matchAll(/saving throw proficiency(?: with)?\s+([A-Za-z,\s]+?)(?:\.|,|;|$)/gi)) {
    match[1]
      .split(/\s+and\s+|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((name) => saves.push(toTitleCase(name)));
  }

  if (/proficiency in all saving throws/i.test(text)) {
    saves.push("Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma");
  }

  if (/expertise in one skill of your choice/i.test(text) || /choose one skill in which you have proficiency/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category: "skill",
      expertise: true,
      choice: {
        count: { kind: "fixed", value: 1 },
        optionCategory: "skill",
      },
      summary: "Choose one skill for expertise",
    } satisfies ProficiencyGrantEffect);
  }

  const expertiseRe = /(?:gain|have)\s+expertise in\s+([A-Za-z' ]+?)(?:\s+skill)?(?:\.|,|;|$)/gi;
  while ((m = expertiseRe.exec(text)) !== null) {
    const raw = m[1]?.trim();
    if (!raw || /\bone\b.*\bchoice\b/i.test(raw)) continue;
    raw
      .split(/\s+and\s+|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((name) => expertise.push(toTitleCase(name)));
  }

  if (/you have Expertise in those two skills/i.test(text)) {
    const listedSkills = Array.from(new Set(
      ["Arcana", "History", "Nature", "Religion"].filter((skill) => new RegExp(`\\b${skill}\\b`, "i").test(text))
    ));
    listedSkills.forEach((name) => expertise.push(name));
  }

  const langRe = /(?:learn|speak|know|understand)\s+(?:the\s+)?([\w]+)\s+language/gi;
  while ((m = langRe.exec(text)) !== null) {
    languages.add(normalizeLanguageName(toTitleCase(m[1])));
  }
  if (/know\s+thieves' cant/i.test(text)) languages.add("Thieves' Cant");

  const byCategory = [
    { category: "armor", values: armor },
    { category: "weapon", values: weapons },
    { category: "tool", values: tools },
    { category: "skill", values: skills },
    { category: "saving_throw", values: saves },
    { category: "language", values: Array.from(languages) },
  ] as const;

  for (const { category, values } of byCategory) {
    if (values.length === 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category,
      grants: Array.from(new Set(values)),
    } satisfies ProficiencyGrantEffect);
  }

  if (expertise.length > 0) {
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category: "skill",
      expertise: true,
      grants: Array.from(new Set(expertise)),
      summary: `Expertise in ${Array.from(new Set(expertise)).join(", ")}`,
    } satisfies ProficiencyGrantEffect);
  }
}

function parseWeaponMasteryEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const normalizedName = source.name.trim();
  if (!/weapon mastery/i.test(normalizedName) && !/mastery properties of/i.test(text)) return;

  const countMatch =
    text.match(/mastery properties of\s+(\w+)\s+kinds? of/i)
    ?? text.match(/mastery properties of\s+(\d+)\s+kinds? of/i)
    ?? text.match(/mastery properties of\s+(\w+)\s+weapons?/i);
  const count = parseWordCount(countMatch?.[1] ?? "") ?? 0;
  const filters: WeaponMasteryEffect["choice"] extends infer T ? T extends { filters?: infer F } ? F : never : never = [];
  if (/simple/i.test(text)) filters.push("simple_weapon");
  if (/martial/i.test(text)) filters.push("martial_weapon");
  if (/melee/i.test(text)) filters.push("melee_weapon");

  if (count > 0) {
    effects.push({
      id: createFeatureEffectId(source, "weapon_mastery", effects.length),
      type: "weapon_mastery",
      source,
      choice: {
        count: { kind: "fixed", value: count },
        optionCategory: "weapon_mastery",
        filters,
        canReplaceOnReset: /finish a long rest/i.test(text) ? "long_rest" : undefined,
      },
      summary: `Choose ${count} weapon masteries`,
    } satisfies WeaponMasteryEffect);
  }
}

function parseDefenseEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const DAMAGE_TYPES = [
    "Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning",
    "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder",
  ] as const;
  const CONDITION_NAMES = [
    "Blinded",
    "Charmed",
    "Deafened",
    "Exhaustion",
    "Frightened",
    "Grappled",
    "Incapacitated",
    "Invisible",
    "Paralyzed",
    "Petrified",
    "Poisoned",
    "Prone",
    "Restrained",
    "Stunned",
    "Unconscious",
  ];

  const rageGate = createRageGate(source, text);

  const addDamageDefense = (mode: DefenseEffect["mode"], rawTargets: string) => {
    const lower = rawTargets.toLowerCase();
    const targets: string[] = DAMAGE_TYPES.filter((damageType) => new RegExp(`\\b${damageType}\\b`, "i").test(lower));
    if (targets.length === 0 && /nonmagical/i.test(lower) && /bludgeoning|piercing|slashing/i.test(lower)) {
      targets.push("Nonmagical B/P/S");
    }
    if (targets.length === 0) return;
    effects.push({
      id: createFeatureEffectId(source, "defense", effects.length),
      type: "defense",
      source,
      mode,
      targets,
      gate: rageGate,
    } satisfies DefenseEffect);
  };

  for (const match of text.matchAll(/resistance to every damage type except ([^.;]+?)(?:damage)?[.;]/gi)) {
    const excluded = new Set(
      DAMAGE_TYPES.filter((damageType) => new RegExp(`\\b${damageType}\\b`, "i").test(match[1] ?? ""))
    );
    const included = DAMAGE_TYPES.filter((damageType) => !excluded.has(damageType));
    if (included.length === 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "defense", effects.length),
      type: "defense",
      source,
      mode: "damage_resistance",
      targets: included,
      gate: rageGate,
      summary: `Resistance to ${included.join(", ")}`,
    } satisfies DefenseEffect);
  }

  for (const match of text.matchAll(/(?:have |gain )?resistance to ([^.;]+?) damage/gi)) {
    addDamageDefense("damage_resistance", match[1]);
  }
  for (const match of text.matchAll(/(?:are|become)\s+resistant to ([^.;]+?) damage/gi)) {
    addDamageDefense("damage_resistance", match[1]);
  }
  for (const match of text.matchAll(/immune to ([^.;]+?) damage/gi)) {
    addDamageDefense("damage_immunity", match[1]);
  }

  const addConditionImmunity = (rawTargets: string) => {
    const targets = rawTargets
      .replace(/\bcondition(s)?\b/gi, "")
      .split(/\s+and\s+|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map(toTitleCase);
    if (targets.length === 0) return;
    effects.push({
      id: createFeatureEffectId(source, "defense", effects.length),
      type: "defense",
      source,
      mode: "condition_immunity",
      targets,
      gate: rageGate,
    } satisfies DefenseEffect);
  };

  for (const match of text.matchAll(/immunity to (?:the\s+)?([A-Za-z,\s]+?) conditions?/gi)) {
    addConditionImmunity(match[1]);
  }

  for (const match of text.matchAll(/immune to (?:the\s+)?([A-Za-z,\s]+?) conditions?/gi)) {
    addConditionImmunity(match[1]);
  }

  for (const condition of CONDITION_NAMES) {
    const escaped = condition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`immune to being\\s+${escaped}`, "i").test(text)) {
      addConditionImmunity(condition);
    }
    if (new RegExp(`(?:can(?:not|'t)|cannot)\\s+be\\s+${escaped}`, "i").test(text)) {
      addConditionImmunity(condition);
    }
  }
}

function parseSpeedEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const rageGate = createRageGate(source, text);
  const armorState =
    /if you aren't wearing any armor/i.test(text) ? "no_armor"
    : /while you aren't wearing heavy armor/i.test(text) ? "not_heavy"
    : undefined;
  const bonusMatch = text.match(/your speed increases by (\d+) feet/i);
  if (bonusMatch) {
    effects.push({
      id: createFeatureEffectId(source, "speed", effects.length),
      type: "speed",
      source,
      mode: "bonus",
      amount: { kind: "fixed", value: Number(bonusMatch[1]) },
      gate: {
        duration: rageGate?.duration ?? "passive",
        ...(armorState ? { armorState } : {}),
      },
    } satisfies SpeedEffect);
  }

  for (const match of text.matchAll(/you (?:have|gain)\s+(?:a\s+)?(Fly|Swim|Climb|Burrow)\s+Speed\s+and\s+(?:a\s+)?(Fly|Swim|Climb|Burrow)\s+Speed equal to your Speed/gi)) {
    [match[1], match[2]].forEach((modeName) => {
      effects.push({
        id: createFeatureEffectId(source, "speed", effects.length),
        type: "speed",
        source,
        mode: "grant_mode",
        movementMode: modeName.trim().toLowerCase() as SpeedEffect["movementMode"],
        amount: { kind: "named_progression", key: "equal_to_speed" },
        gate: {
          ...(rageGate ? { duration: rageGate.duration } : {}),
          ...(armorState ? { armorState } : {}),
        },
      } satisfies SpeedEffect);
    });
  }

  for (const match of text.matchAll(/you (?:have|gain)\s+(?:a\s+)?(Fly|Swim|Climb|Burrow) Speed equal to your Speed/gi)) {
    effects.push({
      id: createFeatureEffectId(source, "speed", effects.length),
      type: "speed",
      source,
      mode: "grant_mode",
      movementMode: match[1].trim().toLowerCase() as SpeedEffect["movementMode"],
      amount: { kind: "named_progression", key: "equal_to_speed" },
      gate: {
        ...(rageGate ? { duration: rageGate.duration } : {}),
        ...(armorState ? { armorState } : {}),
      },
    } satisfies SpeedEffect);
  }

  for (const match of text.matchAll(/you (?:have|gain)\s+(?:a\s+)?(Fly|Swim|Climb|Burrow) Speed of\s+(\d+)\s+feet/gi)) {
    effects.push({
      id: createFeatureEffectId(source, "speed", effects.length),
      type: "speed",
      source,
      mode: "grant_mode",
      movementMode: match[1].trim().toLowerCase() as SpeedEffect["movementMode"],
      amount: { kind: "fixed", value: Number(match[2]) },
      gate: {
        ...(rageGate ? { duration: rageGate.duration } : {}),
        ...(armorState ? { armorState } : {}),
      },
    } satisfies SpeedEffect);
  }
}

function parseArmorClassEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const unarmoredMatch = text.match(/base Armor Class equals 10 plus your ([A-Za-z]+) and ([A-Za-z]+) modifiers/i);
  if (unarmoredMatch) {
    const first = unarmoredMatch[1].trim().toLowerCase().slice(0, 3) as AbilKey;
    const second = unarmoredMatch[2].trim().toLowerCase().slice(0, 3) as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "armor_class", effects.length),
      type: "armor_class",
      source,
      mode: "base_formula",
      base: 10,
      abilities: [first, second],
      gate: {
        duration: "while_unarmored",
        shieldAllowed: /shield and still gain this benefit/i.test(text),
      },
    } satisfies ArmorClassEffect);
    return;
  }

  const floorMatch = text.match(/your AC equals (\d+) plus your ([A-Za-z]+) modifier if that total is higher than the Beast's AC/i);
  if (floorMatch) {
    effects.push({
      id: createFeatureEffectId(source, "armor_class", effects.length),
      type: "armor_class",
      source,
      mode: "minimum_floor",
      base: Number(floorMatch[1]),
      abilities: [floorMatch[2].trim().toLowerCase().slice(0, 3) as AbilKey],
      gate: { duration: "while_wild_shaped" },
    } satisfies ArmorClassEffect);
  }
}

const ABILITY_NAME_MAP: Record<string, AbilKey> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

function parseAbilityScoreEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  // "Increase one ability score by 2, or choose two ability scores and increase each by 1"
  const asiMatch = text.match(
    /increase one (?:of your )?ability scores? by (\d+),? or (?:choose two (?:different )?ability scores? and increase each|increase two (?:of your )?ability scores?) by (\d+)/i,
  );
  if (asiMatch) {
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 1, amount: Number(asiMatch[1]),
      summary: `+${asiMatch[1]} to one ability score`,
    } satisfies AbilityScoreEffect);
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 2, amount: Number(asiMatch[2]),
      summary: `+${asiMatch[2]} to two ability scores`,
    } satisfies AbilityScoreEffect);
    return;
  }

  // "Increase one of your ability scores by N" (single free-choice)
  const freeMatch = text.match(/increase one (?:of your )?ability scores? by (\d+)/i);
  if (freeMatch) {
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 1, amount: Number(freeMatch[1]),
      summary: `+${freeMatch[1]} to one ability score`,
    } satisfies AbilityScoreEffect);
    return;
  }

  // "your Strength or Dexterity score increases by N" (two-choice restricted)
  const twoChoiceMatch = text.match(
    /your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+or\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score increases? by (\d+)/i,
  );
  if (twoChoiceMatch) {
    const a = ABILITY_NAME_MAP[twoChoiceMatch[1].toLowerCase()] as AbilKey;
    const b = ABILITY_NAME_MAP[twoChoiceMatch[2].toLowerCase()] as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      chooseFrom: [a, b], choiceCount: 1, amount: Number(twoChoiceMatch[3]),
      summary: `+${twoChoiceMatch[3]} to ${a.toUpperCase()} or ${b.toUpperCase()}`,
    } satisfies AbilityScoreEffect);
    return;
  }

  // "your Charisma score increases by 1" (fixed, may repeat for multiple abilities)
  for (const match of text.matchAll(/your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score increases? by (\d+)/gi)) {
    const ability = ABILITY_NAME_MAP[match[1].toLowerCase()] as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "fixed",
      ability, choiceCount: 1, amount: Number(match[2]),
      summary: `+${match[2]} ${ability.toUpperCase()}`,
    } satisfies AbilityScoreEffect);
  }
}

function parseHitPointBonusEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (/hit point maximum increases by (?:an amount equal to )?twice your (?:character )?level/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "hit_points", effects.length),
      type: "hit_points", source, mode: "max_bonus",
      amount: { kind: "character_level", multiplier: 2 },
      summary: "+2 max HP per character level",
    } satisfies HitPointEffect);
    return;
  }

  const fixedMatch = text.match(/hit point maximum increases by (\d+)/i);
  if (fixedMatch) {
    effects.push({
      id: createFeatureEffectId(source, "hit_points", effects.length),
      type: "hit_points", source, mode: "max_bonus",
      amount: { kind: "fixed", value: Number(fixedMatch[1]) },
      summary: `+${fixedMatch[1]} max HP`,
    } satisfies HitPointEffect);
  }
}

function parseAttackEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (/martial arts die/i.test(text) && /unarmed strike/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "damage_die_override",
      amount: { kind: "named_progression", key: "monk_martial_arts_die" },
      gate: {
        duration: "passive",
        notes: "unarmed_or_monk_weapon",
      },
      summary: "Martial Arts damage die replaces normal Unarmed Strike or Monk weapon damage.",
    } satisfies AttackEffect);
  }

  if (/dexterity modifier instead of your strength modifier/i.test(text) && /unarmed strikes?/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "weapon_ability_override",
      ability: "dex",
      gate: {
        duration: "passive",
        notes: "weapon_or_unarmed",
      },
      summary: "Use Dexterity for Unarmed Strikes and Monk weapons.",
    } satisfies AttackEffect);
  }

  if (/extra attack as a result of using a weapon that has the Light property/i.test(text) && /add your ability modifier to the damage of that attack/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "add_ability_to_damage",
      gate: {
        duration: "passive",
        weaponFilters: ["light_weapon"],
        notes: "extra_attack_damage",
      },
      summary: "Add your ability modifier to the Light-property extra attack damage.",
    } satisfies AttackEffect);
  }

  if (/add your ability modifier to the damage of the extra attack/i.test(text) && /crossbow that has the Light property/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "add_ability_to_damage",
      gate: {
        duration: "passive",
        weaponFilters: ["light_crossbow"],
        notes: "extra_attack_damage",
      },
      summary: "Add your ability modifier to the Light crossbow extra attack damage.",
    } satisfies AttackEffect);
  }

  if (/make one extra attack as a Bonus Action/i.test(text) && /different weapon, which must be a Melee weapon that lacks the Two-Handed property/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "triggered_attack",
      gate: {
        duration: "passive",
        weaponFilters: ["melee_weapon", "no_two_handed"],
        notes: "light_property_bonus_attack",
      },
      frequency: "special",
      summary: "After a Light-weapon attack, you can make a bonus-action attack with a different melee weapon that lacks Two-Handed.",
    } satisfies AttackEffect);
  }

  if (/rage damage/i.test(text) && /using strength/i.test(text) && /weapon|unarmed strike/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "bonus_damage",
      amount: { kind: "named_progression", key: "barbarian_rage_damage" },
      damageType: "same_as_attack",
      gate: {
        duration: "while_raging",
        attackAbility: "str",
        notes: "weapon_or_unarmed",
      },
      summary: "Rage Damage bonus on Strength weapon and unarmed attacks",
    } satisfies AttackEffect);
  }
}

function parseInitiativeModifierEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (/add your Proficiency Bonus to (?:your )?(?:the )?Initiative/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier", source,
      target: "initiative", mode: "bonus",
      amount: { kind: "proficiency_bonus" },
      summary: "Add Proficiency Bonus to Initiative",
    } satisfies ModifierEffect);
  }
}

function parseSavingThrowModifierEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  for (const match of text.matchAll(/add your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) saving throws/gi)) {
    const amountAbility = ABILITY_NAME_MAP[match[1].toLowerCase()];
    const targetAbility = toTitleCase(match[2]);
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "saving_throw",
      mode: "bonus",
      amount: { kind: "ability_mod", ability: amountAbility },
      appliesTo: [targetAbility],
      summary: `Add ${amountAbility.toUpperCase()} modifier to ${targetAbility} saving throws`,
    } satisfies ModifierEffect);
  }

  for (const match of text.matchAll(/gain a bonus to saving throws equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier(?:\s*\(minimum bonus of \+?(\d+)\))?/gi)) {
    const ability = ABILITY_NAME_MAP[match[1].toLowerCase()];
    const min = match[2] ? Number(match[2]) : undefined;
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "saving_throw",
      mode: "bonus",
      amount: { kind: "ability_mod", ability, ...(min != null ? { min } : {}) },
      summary: `Add ${ability.toUpperCase()} modifier to saving throws`,
    } satisfies ModifierEffect);
  }
}

function parseAdvantageModifierEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const rageGate = createRageGate(source, text);
  const addModifier = (
    mode: "advantage" | "disadvantage",
    target: ModifierEffect["target"],
    appliesTo: string[],
    summary: string,
  ) => {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target,
      mode,
      appliesTo,
      summary,
      gate: rageGate,
    } satisfies ModifierEffect);
  };

  for (const match of text.matchAll(/(?:have|gain)\s+(Advantage|Disadvantage)\s+on\s+(?:all\s+)?(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s*\(([^)]+)\)\s+checks\b/gi)) {
    const mode = match[1].toLowerCase() === "advantage" ? "advantage" : "disadvantage";
    const abilityName = toTitleCase(match[2]);
    const skillNames = splitSkillNames(match[3]);
    const matchEnd = (match.index ?? 0) + match[0].length;
    if (skillNames.length === 0 || hasContextualQualifier(text, matchEnd)) continue;
    addModifier(mode, "skill_check", skillNames, `${mode === "advantage" ? "Advantage" : "Disadvantage"} on ${abilityName} (${skillNames.join(", ")}) checks`);
  }

  for (const match of text.matchAll(/(?:have|gain)\s+(Advantage|Disadvantage)\s+on\s+(?:all\s+)?(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+checks\b/gi)) {
    const mode = match[1].toLowerCase() === "advantage" ? "advantage" : "disadvantage";
    const abilityName = toTitleCase(match[2]);
    const matchEnd = (match.index ?? 0) + match[0].length;
    if (hasContextualQualifier(text, matchEnd)) continue;
    addModifier(mode, "ability_check", [abilityName], `${mode === "advantage" ? "Advantage" : "Disadvantage"} on ${abilityName} checks`);
  }

  for (const match of text.matchAll(/(?:have|gain)\s+(Advantage|Disadvantage)\s+on\s+(?:all\s+)?(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throws\b/gi)) {
    const mode = match[1].toLowerCase() === "advantage" ? "advantage" : "disadvantage";
    const abilityName = toTitleCase(match[2]);
    const matchEnd = (match.index ?? 0) + match[0].length;
    if (hasContextualQualifier(text, matchEnd)) continue;
    addModifier(mode, "saving_throw", [abilityName], `${mode === "advantage" ? "Advantage" : "Disadvantage"} on ${abilityName} saving throws`);
  }
}

function parseArmorClassBonusEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  // "+1 bonus to AC while wearing armor" — Defense fighting style
  const armorBonusMatch = text.match(/\+(\d+)\s+bonus to (?:your\s+)?(?:Armor Class|AC)\s+while (?:you are )?wearing armor/i);
  if (armorBonusMatch) {
    effects.push({
      id: createFeatureEffectId(source, "armor_class", effects.length),
      type: "armor_class", source, mode: "bonus",
      bonus: { kind: "fixed", value: Number(armorBonusMatch[1]) },
      gate: { duration: "passive", armorState: "not_unarmored" },
      summary: `+${armorBonusMatch[1]} AC while wearing armor`,
    } satisfies ArmorClassEffect);
    return;
  }

  const mediumArmorDexCapMatch = text.match(/while you're wearing Medium armor, you can add (\d+), rather than (\d+) to your AC if you have a Dexterity score of (\d+) or higher/i);
  if (mediumArmorDexCapMatch) {
    const bonusIncrease = Number(mediumArmorDexCapMatch[1]) - Number(mediumArmorDexCapMatch[2]);
    const minimumDex = Number(mediumArmorDexCapMatch[3]);
    if (bonusIncrease > 0) {
      effects.push({
        id: createFeatureEffectId(source, "armor_class", effects.length),
        type: "armor_class", source, mode: "bonus",
        bonus: { kind: "fixed", value: bonusIncrease },
        gate: { duration: "passive", armorState: "not_unarmored", notes: `medium_armor_dex_cap:${minimumDex}` },
        summary: `+${bonusIncrease} AC in Medium armor when Dexterity is ${minimumDex}+`,
      } satisfies ArmorClassEffect);
      return;
    }
  }

  // Generic "+N to AC / Armor Class"
  const genericMatch = text.match(/\+(\d+)\s+(?:bonus\s+)?to (?:your\s+)?(?:Armor Class|AC)\b/i);
  if (genericMatch) {
    effects.push({
      id: createFeatureEffectId(source, "armor_class", effects.length),
      type: "armor_class", source, mode: "bonus",
      bonus: { kind: "fixed", value: Number(genericMatch[1]) },
      summary: `+${genericMatch[1]} AC`,
    } satisfies ArmorClassEffect);
  }
}

function parseSensesEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const kindMap: Record<string, SensesEffect["senses"][number]["kind"]> = {
    darkvision: "darkvision", blindsight: "blindsight",
    tremorsense: "tremorsense", truesight: "truesight",
  };
  const senses: SensesEffect["senses"] = [];

  const re = /\b(Darkvision|Blindsight|Tremorsense|Truesight)\b[^.]*?(?:out to|with a range of|range of|up to)?\s*(\d+)\s*feet/gi;
  for (const match of text.matchAll(re)) {
    const kind = kindMap[match[1].toLowerCase()];
    const range = Number(match[2]);
    if (!kind || !range) continue;
    const existing = senses.find((s) => s.kind === kind);
    if (existing) { if (range > existing.range) existing.range = range; }
    else senses.push({ kind, range });
  }

  if (senses.length > 0) {
    effects.push({
      id: createFeatureEffectId(source, "senses", effects.length),
      type: "senses", source, mode: "grant", senses,
      summary: senses.map((s) => `${s.kind} ${s.range}ft`).join(", "),
    } satisfies SensesEffect);
  }
}

function parsePassiveScoreEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  // "+5 to your passive Wisdom (Perception)" — Observant
  const passiveMatch = text.match(/\+(\d+)(?:\s+bonus)?\s+to (?:your\s+)?passive\s+\w/i);
  if (passiveMatch) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier", source,
      target: "passive_score", mode: "bonus",
      amount: { kind: "fixed", value: Number(passiveMatch[1]) },
      summary: `+${passiveMatch[1]} to passive scores`,
    } satisfies ModifierEffect);
  }
}

export function parseFeatureEffects(input: ParseFeatureEffectsInput): ParsedFeatureEffects {
  const cleanText = cleanupText(input.text);
  const source: FeatureEffectSource = { ...input.source, text: cleanText };
  const effects: FeatureEffect[] = [];

  if (cleanText) {
    parseAbilityScoreEffects(source, cleanText, effects);
    parseSpellChoiceEffects(source, cleanText, effects);
    parseKnownSpellGrantEffects(source, cleanText, effects);
    if (!input.suppressStructuredSpellGrants) {
      parseAlwaysPreparedSpellGrantEffects(source, cleanText, effects);
      parseExpandedListSpellGrantEffects(source, cleanText, effects);
    }
    parseRitualOnlySpellGrantEffects(source, cleanText, effects);
    parseSpellGrantEffects(source, cleanText, effects);
    parseResourceGrantEffects(source, cleanText, effects);
    parseProficiencyGrantEffects(source, cleanText, effects);
    parseWeaponMasteryEffects(source, cleanText, effects);
    parseDefenseEffects(source, cleanText, effects);
    parseSpeedEffects(source, cleanText, effects);
    parseArmorClassEffects(source, cleanText, effects);
    parseArmorClassBonusEffects(source, cleanText, effects);
    parseHitPointBonusEffects(source, cleanText, effects);
    parseAttackEffects(source, cleanText, effects);
    parseInitiativeModifierEffects(source, cleanText, effects);
    parseSavingThrowModifierEffects(source, cleanText, effects);
    parseAdvantageModifierEffects(source, cleanText, effects);
    parseSensesEffects(source, cleanText, effects);
    parsePassiveScoreEffects(source, cleanText, effects);
  }

  return { source, effects };
}

export function buildGrantedSpellDataFromEffects(
  parsed: ParsedFeatureEffects[],
  scores: Record<AbilKey, number | null>,
  level?: number | null,
): { spells: GrantedSpellCast[]; resources: ResourceCounter[] } {
  const spells: GrantedSpellCast[] = [];
  const resources: ResourceCounter[] = [];

  const resolveScalingValue = (value: ScalingValue | undefined): number | null =>
    resolveScalingValueInContext(value, { scores, level });

  const resourceByKey = new Map<string, ResourceCounter>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "resource_grant") {
        const max = resolveScalingValue(effect.max);
        if (max == null) continue;
        const reset =
          effect.reset === "short_rest" ? "S"
          : effect.reset === "long_rest" ? "L"
          : effect.reset === "short_or_long_rest" ? "SL"
          : "L";
        resourceByKey.set(effect.resourceKey, {
          key: effect.resourceKey,
          name: effect.label,
          current: max,
          max,
          reset,
          restoreAmount:
            effect.restoreAmount === "all" || effect.restoreAmount === "one"
              ? effect.restoreAmount
              : undefined,
        });
      }
    }
  }

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "spell_grant") continue;
      if (effect.requiredLevel != null && level != null && level < effect.requiredLevel) continue;
      if (effect.mode === "free_cast" && effect.resourceKey) {
        const resource = resourceByKey.get(effect.resourceKey);
        if (!resource) continue;
        spells.push({
          key: `granted-spell:${effect.resourceKey}`,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "limited",
          note: `Free cast ${resource.max} time${resource.max === 1 ? "" : "s"} per ${resource.reset === "S" ? "Short Rest" : resource.reset === "SL" ? "Short or Long Rest" : "Long Rest"}. No spell slot required.`,
          resourceKey: effect.resourceKey,
          reset: resource.reset,
        });
        continue;
      }

      if (effect.mode === "at_will") {
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "at_will",
          note: effect.riderSummary ?? "",
        });
        continue;
      }

      if (effect.mode === "known") {
        const isCantrip = /\bcantrip\b/i.test(effect.summary ?? "") || effect.requiredLevel === 0;
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "known",
          note: effect.riderSummary
            ? `${isCantrip ? "Known cantrip." : "Known spell."} ${effect.riderSummary}`
            : (isCantrip ? "Known cantrip." : "Known spell."),
        });
        continue;
      }

      if (effect.mode === "always_prepared") {
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "always_prepared",
          note: effect.riderSummary ? `Always prepared. ${effect.riderSummary}` : "Always prepared.",
        });
        continue;
      }

      if (effect.mode === "expanded_list") {
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "expanded_list",
          note: "Added to your spell list.",
        });
      }
    }
  }

  return { spells, resources: Array.from(resourceByKey.values()) };
}

function clampScalingValue(value: number, scaling: Extract<ScalingValue, { min?: number; max?: number }>): number {
  const withMin = scaling.min != null ? Math.max(scaling.min, value) : value;
  return scaling.max != null ? Math.min(scaling.max, withMin) : withMin;
}

function resolveScalingValueInContext(value: ScalingValue | undefined, context: ScalingResolutionContext): number | null {
  if (!value) return null;
  if (value.kind === "fixed") return value.value;
  if (value.kind === "ability_mod") {
    const score = context.scores?.[value.ability] ?? 10;
    const mod = Math.floor((score - 10) / 2);
    return clampScalingValue(mod, value);
  }
  if (value.kind === "proficiency_bonus") {
    if (context.level == null) return null;
    const total = proficiencyBonus(context.level) * (value.multiplier ?? 1);
    return clampScalingValue(total, value);
  }
  if (value.kind === "character_level") {
    if (context.level == null) return null;
    const total = context.level * (value.multiplier ?? 1);
    return clampScalingValue(total, value);
  }
  if (value.kind === "half_character_level") {
    if (context.level == null) return null;
    const raw = context.level / 2;
    const total = value.round === "up" ? Math.ceil(raw) : Math.floor(raw);
    return clampScalingValue(total, value);
  }
  if (value.kind === "named_progression") {
    if (value.key === "barbarian_rage_damage") {
      if (context.level == null) return null;
      if (context.level >= 16) return 4;
      if (context.level >= 9) return 3;
      return 2;
    }
  }
  return null;
}

function resolveScalingDiceInContext(
  value: ScalingDice | undefined,
  context: { level?: number | null; scores?: Partial<Record<AbilKey, number | null>> }
): string | null {
  if (!value) return null;
  if (value.kind === "fixed") return value.dice;
  if (value.kind === "per_scalar") {
    const scalar = resolveScalingValueInContext(value.scalar, context);
    return scalar != null && scalar > 0 ? `${scalar}${value.die}` : null;
  }
  if (value.kind === "named_progression") {
    if (value.key === "monk_martial_arts_die") {
      const level = context.level ?? null;
      if (level == null) return null;
      if (level >= 17) return "1d12";
      if (level >= 11) return "1d10";
      if (level >= 5) return "1d8";
      return "1d6";
    }
  }
  return null;
}

export function collectTaggedGrantsFromEffects(parsed: ParsedFeatureEffects[]): {
  armor: TaggedItem[];
  weapons: TaggedItem[];
  tools: TaggedItem[];
  skills: TaggedItem[];
  expertise: TaggedItem[];
  saves: TaggedItem[];
  languages: TaggedItem[];
  masteries: TaggedItem[];
} {
  const result = {
    armor: [] as TaggedItem[],
    weapons: [] as TaggedItem[],
    tools: [] as TaggedItem[],
    skills: [] as TaggedItem[],
    expertise: [] as TaggedItem[],
    saves: [] as TaggedItem[],
    languages: [] as TaggedItem[],
    masteries: [] as TaggedItem[],
  };

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "proficiency_grant" && effect.grants?.length) {
        const target =
          effect.expertise ? result.expertise
          : effect.category === "armor" ? result.armor
          : effect.category === "weapon" ? result.weapons
          : effect.category === "tool" ? result.tools
          : effect.category === "skill" ? result.skills
          : effect.category === "saving_throw" ? result.saves
          : effect.category === "language" ? result.languages
          : null;
        if (!target) continue;
        for (const name of effect.grants) target.push({ name, source: effect.source.name });
      }
      if (effect.type === "weapon_mastery" && effect.grants?.length) {
        for (const name of effect.grants) result.masteries.push({ name, source: effect.source.name });
      }
    }
  }

  return result;
}

export function collectSpellChoicesFromEffects(parsed: ParsedFeatureEffects[]): SpellChoiceEffect[] {
  const result: SpellChoiceEffect[] = [];
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "spell_choice") result.push(effect);
    }
  }
  return result;
}

export function collectDefensesFromEffects(parsed: ParsedFeatureEffects[], opts?: EffectStateContext): {
  resistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
} {
  const resistances = new Set<string>();
  const damageImmunities = new Set<string>();
  const conditionImmunities = new Set<string>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "defense") continue;
      if (!isEffectActive(effect, opts)) continue;
      if (effect.mode === "damage_resistance") {
        effect.targets.forEach((target) => resistances.add(target));
      }
      if (effect.mode === "damage_immunity") {
        effect.targets.forEach((target) => damageImmunities.add(target));
      }
      if (effect.mode === "condition_immunity") {
        effect.targets.forEach((target) => conditionImmunities.add(target));
      }
    }
  }

  return {
    resistances: Array.from(resistances),
    damageImmunities: Array.from(damageImmunities),
    conditionImmunities: Array.from(conditionImmunities),
  };
}

export function deriveSpeedBonusFromEffects(parsed: ParsedFeatureEffects[], opts?: { armorState?: "any" | "no_armor" | "not_heavy"; raging?: boolean }): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "speed" || effect.mode !== "bonus") continue;
      if (!isEffectActive(effect, opts)) continue;
      if (effect.amount?.kind === "fixed") total += effect.amount.value;
    }
  }
  return total;
}

export function collectMovementModesFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: { baseWalkSpeed?: number; raging?: boolean; armorState?: "any" | "no_armor" | "not_heavy" }
): Array<{ mode: Exclude<SpeedEffect["movementMode"], "walk" | undefined>; speed: number | null }> {
  const bestByMode = new Map<Exclude<SpeedEffect["movementMode"], "walk" | undefined>, number | null>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "speed" || effect.mode !== "grant_mode" || !effect.movementMode || effect.movementMode === "walk") continue;
      if (!isEffectActive(effect, opts)) continue;
      const mode = effect.movementMode;
      const amount = effect.amount;
      const resolved =
        amount?.kind === "fixed" ? amount.value
        : amount?.kind === "named_progression" && amount.key === "equal_to_speed" ? (opts?.baseWalkSpeed ?? null)
        : null;
      const existing = bestByMode.get(mode);
      if (existing == null || (resolved != null && resolved > existing)) bestByMode.set(mode, resolved);
    }
  }

  return Array.from(bestByMode.entries()).map(([mode, speed]) => ({ mode, speed }));
}

export function deriveArmorClassBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: {
    armorEquipped?: boolean;
    armorCategory?: "light" | "medium" | "heavy" | "shield" | "none";
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
  }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "armor_class" || effect.mode !== "bonus") continue;
      const gateArmorState = effect.gate?.armorState ?? "any";
      if (gateArmorState === "not_unarmored" && !opts?.armorEquipped) continue;
      if (gateArmorState === "no_armor" && opts?.armorEquipped) continue;
      if (effect.gate?.notes?.startsWith("medium_armor_dex_cap:")) {
        if (opts?.armorCategory !== "medium") continue;
        const minimumDex = Number(effect.gate.notes.split(":")[1] ?? 0);
        const dexScore = opts?.scores?.dex ?? 10;
        if (dexScore < minimumDex) continue;
      }
      const resolved = resolveScalingValueInContext(effect.bonus, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function deriveHitPointMaxBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: { level?: number | null; scores?: Partial<Record<AbilKey, number | null>> }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "hit_points" || effect.mode !== "max_bonus") continue;
      if (
        !("kind" in effect.amount)
        || effect.amount.kind === "per_scalar"
        || ("dice" in effect.amount)
      ) continue;
      const resolved = resolveScalingValueInContext(effect.amount, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function deriveModifierBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  target: ModifierEffect["target"],
  opts?: {
    appliesTo?: string;
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
    raging?: boolean;
  }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "modifier" || effect.target !== target || effect.mode !== "bonus") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.appliesTo?.length && opts?.appliesTo && !effect.appliesTo.some((value) => value.toLowerCase() === opts.appliesTo?.toLowerCase())) continue;
      if (effect.appliesTo?.length && !opts?.appliesTo) continue;
      const resolved = resolveScalingValueInContext(effect.amount, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function deriveModifierStateFromEffects(
  parsed: ParsedFeatureEffects[],
  target: ModifierEffect["target"],
  opts?: {
    appliesTo?: string;
    raging?: boolean;
  }
): { advantage: boolean; disadvantage: boolean } {
  let advantage = false;
  let disadvantage = false;

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "modifier" || effect.target !== target) continue;
      if (effect.mode !== "advantage" && effect.mode !== "disadvantage") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.appliesTo?.length && opts?.appliesTo && !effect.appliesTo.some((value) => value.toLowerCase() === opts.appliesTo?.toLowerCase())) continue;
      if (effect.appliesTo?.length && !opts?.appliesTo) continue;
      if (effect.mode === "advantage") advantage = true;
      if (effect.mode === "disadvantage") disadvantage = true;
    }
  }

  return { advantage, disadvantage };
}

export function collectSensesFromEffects(parsed: ParsedFeatureEffects[]): Array<{ kind: SensesEffect["senses"][number]["kind"]; range: number }> {
  const bestByKind = new Map<SensesEffect["senses"][number]["kind"], number>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "senses" || effect.mode !== "grant") continue;
      for (const sense of effect.senses) {
        const current = bestByKind.get(sense.kind) ?? 0;
        if (sense.range > current) bestByKind.set(sense.kind, sense.range);
      }
    }
  }

  return Array.from(bestByKind.entries()).map(([kind, range]) => ({ kind, range }));
}

export function deriveAttackDamageBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: {
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
    raging?: boolean;
    attackAbility?: AbilKey;
    isWeapon?: boolean;
    isUnarmed?: boolean;
  }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "bonus_damage") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.gate?.attackAbility && effect.gate.attackAbility !== opts?.attackAbility) continue;
      if (effect.gate?.notes === "weapon_or_unarmed" && !opts?.isWeapon && !opts?.isUnarmed) continue;
      const amount = "kind" in (effect.amount ?? {}) ? resolveScalingValueInContext(effect.amount as ScalingValue, {
        level: opts?.level,
        scores: opts?.scores,
      }) : null;
      if (amount != null) total += amount;
    }
  }
  return total;
}

export function deriveAttackAbilityOverrideFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: {
    raging?: boolean;
    isWeapon?: boolean;
    isUnarmed?: boolean;
  }
): AbilKey | null {
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "weapon_ability_override") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.gate?.notes === "weapon_or_unarmed" && !opts?.isWeapon && !opts?.isUnarmed) continue;
      if (effect.ability) return effect.ability;
    }
  }
  return null;
}

export function deriveAttackDamageDiceOverrideFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: {
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
    raging?: boolean;
    isWeapon?: boolean;
    isUnarmed?: boolean;
  }
): string | null {
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "damage_die_override") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.gate?.notes === "unarmed_or_monk_weapon" && !opts?.isWeapon && !opts?.isUnarmed) continue;
      const dice = resolveScalingDiceInContext(effect.amount as ScalingDice | undefined, {
        level: opts?.level,
        scores: opts?.scores,
      });
      if (dice) return dice;
    }
  }
  return null;
}

export function deriveUnarmoredDefenseFromEffects(
  parsed: ParsedFeatureEffects[],
  scores: Record<AbilKey, number | null>,
  opts: { armorEquipped: boolean; shieldEquipped: boolean }
): number | null {
  if (opts.armorEquipped) return null;
  let best: number | null = null;

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "armor_class" || effect.mode !== "base_formula" || effect.base == null || !effect.abilities?.length) continue;
      if (effect.gate?.duration === "while_unarmored" && opts.armorEquipped) continue;
      if (opts.shieldEquipped && effect.gate?.shieldAllowed === false) continue;
      const total = effect.base + effect.abilities.reduce((sum, ability) => {
        const score = scores[ability] ?? 10;
        return sum + Math.floor((score - 10) / 2);
      }, 0);
      best = best == null ? total : Math.max(best, total);
    }
  }

  return best;
}

export function canAddAbilityModifierToExtraAttackDamageFromEffects(
  parsed: ParsedFeatureEffects[],
  item: WeaponLike | null | undefined
): boolean {
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "add_ability_to_damage") continue;
      if (weaponMatchesFilters(item, effect.gate?.weaponFilters)) return true;
    }
  }
  return false;
}

export function canUseWeaponForBonusAttackFromEffects(
  parsed: ParsedFeatureEffects[],
  item: WeaponLike | null | undefined
): boolean {
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "attack" || effect.mode !== "triggered_attack") continue;
      if (weaponMatchesFilters(item, effect.gate?.weaponFilters)) return true;
    }
  }
  return false;
}
