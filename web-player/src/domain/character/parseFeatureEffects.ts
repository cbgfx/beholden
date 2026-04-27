import type { AbilKey, GrantedSpellCast, ResourceCounter, TaggedItem } from "@/views/character/CharacterSheetTypes";
import { normalizeLanguageName, normalizeResourceKey, proficiencyBonus } from "@/views/character/CharacterSheetUtils";
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
  type AttackEffect,
  type WeaponMasteryEffect,
  type WeaponFilter,
} from "@/domain/character/featureEffects";
import {
  cleanupText,
  hasContextualQualifier,
  isProficiencyNoiseToken,
  normalizeSkillName,
  parseWordCount,
  splitSkillNames,
} from "@/domain/character/parseFeatureEffects.normalizers";
import { parseSpellChoiceEffects } from "@/domain/character/parseFeatureEffects.choices";
import { parseItemCanCastSpellEffects, parseSpellGrantEffects } from "@/domain/character/parseFeatureEffects.grants";

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

interface WeaponLike {
  name?: string | null;
  type?: string | null;
  properties?: string[] | null;
  dmg1?: string | null;
  dmg2?: string | null;
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
      case "heavy_weapon":
        return hasWeaponProperty(item, "H");
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

function parseResourceGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const reset =
    /finish a short or long rest/i.test(text) ? "short_or_long_rest"
    : /finish a short rest/i.test(text) ? "short_rest"
    : /finish a long rest/i.test(text) ? "long_rest"
    : undefined;

  const bardicInspirationUsesMatch = text.match(/(?:you can confer a Bardic Inspiration die|you can use Bardic Inspiration)[^.]*a number of times equal to your Charisma modifier(?:\s*\(minimum of once\))?/i);
  if (bardicInspirationUsesMatch && reset) {
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey: normalizeResourceKey("Bardic Inspiration"),
      label: "Bardic Inspiration",
      max: { kind: "ability_mod", ability: "cha", min: 1 },
      reset,
      restoreAmount: "all",
      summary: "Bardic Inspiration uses",
    });
  }

  const bardicInspirationResetMatch = text.match(/regain all your expended uses of Bardic Inspiration when you finish a (Short or Long|Short|Long) Rest/i);
  if (bardicInspirationResetMatch) {
    const bardicReset =
      /Short or Long/i.test(bardicInspirationResetMatch[1]) ? "short_or_long_rest"
      : /Short/i.test(bardicInspirationResetMatch[1]) ? "short_rest"
      : "long_rest";
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey: normalizeResourceKey("Bardic Inspiration"),
      label: "Bardic Inspiration",
      max: { kind: "ability_mod", ability: "cha", min: 1 },
      reset: bardicReset,
      restoreAmount: "all",
      summary: "Bardic Inspiration uses",
    });
  }

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

  for (const match of text.matchAll(/you can use (?:the )?(?:this feature|this trait|this ability|this benefit|[A-Z][A-Za-z' -]+?) a number of times equal to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier(?:\s*\(minimum of once\))?/gi)) {
    if (!reset) continue;
    const ability = ABILITY_NAME_MAP[match[1].toLowerCase()];
    if (!ability) continue;
    const label = sourceLabel || match[0].replace(/^you can use (?:the )?/i, "").trim();
    const resourceKey = normalizeResourceKey(label);
    const alreadyEmitted = effects.some(
      (e) => e.type === "resource_grant" && e.source === source && (e as { resourceKey?: string }).resourceKey === resourceKey,
    );
    if (alreadyEmitted) continue;
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label,
      max: { kind: "ability_mod", ability, min: 1 },
      reset,
      restoreAmount: "all",
      summary: `${label} uses`,
    });
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
    const parsed = toTitleCase(m[1].trim());
    if (isProficiencyNoiseToken(parsed)) continue;
    tools.push(parsed);
  }

  const skillRe = /proficiency in\s+([\w\s]+?)(?:\.|,|\band\b|$)/gi;
  while ((m = skillRe.exec(text)) !== null) {
    splitSkillNames(m[1]).forEach((name) => skills.push(name));
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

  for (const match of text.matchAll(/gain proficiency (?:with|in)\s+(a|an|another|one|two|three|four|five|six|\d+)\s+(skills?|tools?|languages?)\s+of your choice/gi)) {
    const count = parseWordCount(match[1] ?? "") ?? 0;
    if (count <= 0) continue;
    const rawCategory = String(match[2] ?? "").toLowerCase();
    const optionCategory =
      rawCategory.startsWith("skill") ? "skill"
      : rawCategory.startsWith("tool") ? "tool"
      : rawCategory.startsWith("language") ? "language"
      : null;
    if (!optionCategory) continue;
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category: optionCategory,
      choice: {
        count: { kind: "fixed", value: count },
        optionCategory,
      },
      summary: `Choose ${count} ${optionCategory}${count === 1 ? "" : "s"} for proficiency`,
    } satisfies ProficiencyGrantEffect);
  }

  for (const match of text.matchAll(
    /expertise in\s+(one|two|three|four|five|six|\d+)(?:\s+more)?\s+of your skill proficiencies of your choice/gi,
  )) {
    const count = parseWordCount(match[1] ?? "") ?? 0;
    if (count <= 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category: "skill",
      expertise: true,
      choice: {
        count: { kind: "fixed", value: count },
        optionCategory: "skill",
      },
      summary: `Choose ${count} skill${count === 1 ? "" : "s"} for expertise`,
    } satisfies ProficiencyGrantEffect);
  }

  for (const match of text.matchAll(/(?:learn|know)\s+(one|two|three|four|five|six|\d+)\s+languages?\s+of your choice\b/gi)) {
    const count = parseWordCount(match[1] ?? "") ?? 0;
    if (count <= 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category: "language",
      choice: {
        count: { kind: "fixed", value: count },
        optionCategory: "language",
      },
      summary: `Choose ${count} language${count === 1 ? "" : "s"} for proficiency`,
    } satisfies ProficiencyGrantEffect);
  }

  if (
    /expertise in one skill of your choice/i.test(text)
    || /choose one skill in which you have proficiency/i.test(text)
  ) {
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
    if (
      !raw
      || /\bone\b.*\bchoice\b/i.test(raw)
      || /\bof your\b/i.test(raw)
      || /\bproficienc(?:y|ies)\b/i.test(raw)
      || /\bchoice\b/i.test(raw)
    ) continue;
    raw
      .split(/\s+and\s+|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((name) => normalizeSkillName(name))
      .filter((name): name is string => Boolean(name))
      .forEach((name) => expertise.push(name));
  }

  if (/you have Expertise in those two skills/i.test(text)) {
    const listedSkills = Array.from(new Set(
      ["Arcana", "History", "Nature", "Religion"].filter((skill) => new RegExp(`\\b${skill}\\b`, "i").test(text))
    ));
    listedSkills.forEach((name) => expertise.push(name));
  }

  const langRe = /(?:learn|speak|know|understand)\s+(?:the\s+)?([\w]+)\s+language/gi;
  while ((m = langRe.exec(text)) !== null) {
    const parsed = normalizeLanguageName(toTitleCase(m[1]));
    if (!parsed || isProficiencyNoiseToken(parsed)) continue;
    languages.add(parsed);
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

  // "your Strength or Dexterity score increases by N"
  // or "Increase your Strength or Dexterity score by N" (two-choice restricted)
  const twoChoiceMatch = text.match(
    /(?:your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+or\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score increases?|increase\s+your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+or\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score)\s+by\s+(\d+)/i,
  );
  if (twoChoiceMatch) {
    const firstAbility = (twoChoiceMatch[1] ?? twoChoiceMatch[3]) as string;
    const secondAbility = (twoChoiceMatch[2] ?? twoChoiceMatch[4]) as string;
    const amount = Number(twoChoiceMatch[5]);
    const a = ABILITY_NAME_MAP[firstAbility.toLowerCase()] as AbilKey;
    const b = ABILITY_NAME_MAP[secondAbility.toLowerCase()] as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      chooseFrom: [a, b], choiceCount: 1, amount,
      summary: `+${amount} to ${a.toUpperCase()} or ${b.toUpperCase()}`,
    } satisfies AbilityScoreEffect);
    return;
  }

  // "your Charisma score increases by 1"
  // or "Increase your Dexterity score by 1" (fixed, may repeat for multiple abilities)
  for (const match of text.matchAll(/(?:your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score increases?|increase\s+your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score)\s+by\s+(\d+)/gi)) {
    const abilityToken = (match[1] ?? match[2]) as string;
    const amount = Number(match[3]);
    const ability = ABILITY_NAME_MAP[abilityToken.toLowerCase()] as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "fixed",
      ability, choiceCount: 1, amount,
      summary: `+${amount} ${ability.toUpperCase()}`,
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
  const isArcheryFightingStyle = /\bfighting style\s*:\s*archery\b/i.test(source.name);
  if (
    isArcheryFightingStyle
    || /gain a \+?2\s+bonus to attack rolls you make with ranged weapons?/i.test(text)
  ) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "attack_roll",
      mode: "bonus",
      amount: { kind: "fixed", value: 2 },
      gate: { duration: "passive", weaponFilters: ["ranged_weapon"] },
      summary: "+2 to attack rolls with ranged weapons",
    } satisfies ModifierEffect);
  }

  for (const match of text.matchAll(/gain a \+?(\d+)\s+bonus to attack rolls you make with ranged weapons?/gi)) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (isArcheryFightingStyle && amount === 2) continue;
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "attack_roll",
      mode: "bonus",
      amount: { kind: "fixed", value: amount },
      gate: { duration: "passive", weaponFilters: ["ranged_weapon"] },
      summary: `+${amount} to attack rolls with ranged weapons`,
    } satisfies ModifierEffect);
  }

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

  if (/bardic inspiration die plus your dexterity modifier/i.test(text) && /instead of the strike'?s normal damage/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "damage_die_override",
      amount: { kind: "named_progression", key: "bardic_inspiration_die" },
      gate: {
        duration: "passive",
        notes: "unarmed_only",
      },
      summary: "Use your Bardic Inspiration die for Unarmed Strike damage.",
    } satisfies AttackEffect);
  }

  if (/dexterity(?:\s+modifier)?\s+instead of (?:your\s+)?strength(?:\s+modifier)?/i.test(text) && /unarmed strikes?/i.test(text)) {
    const appliesToMonkWeapons = /monk weapons?/i.test(text);
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "weapon_ability_override",
      ability: "dex",
      gate: {
        duration: "passive",
        notes: appliesToMonkWeapons ? "unarmed_or_monk_weapon" : "unarmed_only",
      },
      summary: appliesToMonkWeapons
        ? "Use Dexterity for Unarmed Strikes and Monk weapons."
        : "Use Dexterity for Unarmed Strikes.",
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
  const hasDirectInitiativePbText = /add your Proficiency Bonus to (?:your )?(?:the )?Initiative/i.test(text);
  const hasRollInitiativePbText = /\bwhen you roll initiative\b/i.test(text) && /\badd your proficiency bonus to (?:the )?roll\b/i.test(text);
  const isAlertNameFallback = /\balert\b/i.test(source.name) && (!text || /\binitiative\b/i.test(text));
  if (hasDirectInitiativePbText || hasRollInitiativePbText || isAlertNameFallback) {
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
  const bonusSenses: SensesEffect["senses"] = [];

  const re = /\b(Darkvision|Blindsight|Tremorsense|Truesight)\b[^.]*?(?:out to|with a range of|range of|up to)?\s*(\d+)\s*feet/gi;
  for (const match of text.matchAll(re)) {
    const kind = kindMap[match[1].toLowerCase()];
    const range = Number(match[2]);
    if (!kind || !range) continue;
    const existing = senses.find((s) => s.kind === kind);
    if (existing) { if (range > existing.range) existing.range = range; }
    else senses.push({ kind, range });
  }

  for (const match of text.matchAll(/\b(?:if you already have|if you have|the range of)\s+(Darkvision|Blindsight|Tremorsense|Truesight)[^.]*?increases?\s+by\s+(\d+)\s*feet/gi)) {
    const kind = kindMap[match[1].toLowerCase()];
    const range = Number(match[2]);
    if (!kind || !range) continue;
    const existing = bonusSenses.find((s) => s.kind === kind);
    if (existing) existing.range += range;
    else bonusSenses.push({ kind, range });
  }

  // Handles pronoun phrasing like "If you already have Darkvision ... its range increases by 60 feet."
  // Avoid double-counting Umbral Sight style text where both:
  // "If you already have Darkvision ... increases by X"
  // and "its range increases by X" appear in the same sentence.
  const hasExplicitDarkvisionBonusClause = /\b(?:if you already have|if you have|the range of)\s+Darkvision[^.]*?increases?\s+by\s+\d+\s*feet/i.test(text);
  if (!hasExplicitDarkvisionBonusClause && /already have darkvision/i.test(text)) {
    const pronounBonus = text.match(/\bits range increases?\s+by\s+(\d+)\s*feet/i);
    if (pronounBonus) {
      const range = Number(pronounBonus[1]);
      if (Number.isFinite(range) && range > 0) {
        const existing = bonusSenses.find((s) => s.kind === "darkvision");
        if (existing) existing.range += range;
        else bonusSenses.push({ kind: "darkvision", range });
      }
    }
  }

  if (senses.length > 0) {
    effects.push({
      id: createFeatureEffectId(source, "senses", effects.length),
      type: "senses", source, mode: "grant", senses,
      summary: senses.map((s) => `${s.kind} ${s.range}ft`).join(", "),
    } satisfies SensesEffect);
  }

  if (bonusSenses.length > 0) {
    effects.push({
      id: createFeatureEffectId(source, "senses", effects.length),
      type: "senses",
      source,
      mode: "bonus",
      senses: bonusSenses,
      gate: { notes: "requires_existing_sense" },
      summary: bonusSenses.map((s) => `${s.kind} +${s.range}ft`).join(", "),
    } satisfies SensesEffect);
  }

  if (
    /weapon that has the Heavy property/i.test(text)
    && /extra damage/i.test(text)
    && /equals your Proficiency Bonus/i.test(text)
  ) {
    effects.push({
      id: createFeatureEffectId(source, "attack", effects.length),
      type: "attack",
      source,
      mode: "bonus_damage",
      amount: { kind: "proficiency_bonus" },
      gate: {
        duration: "passive",
        weaponFilters: ["heavy_weapon"],
      },
      summary: "Heavy weapon hits deal extra damage equal to Proficiency Bonus",
    } satisfies AttackEffect);
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

  parseAbilityScoreEffects(source, cleanText, effects);
  parseSpellChoiceEffects(source, cleanText, effects);
  parseSpellGrantEffects(source, cleanText, effects, {
    suppressStructuredSpellGrants: Boolean(input.suppressStructuredSpellGrants),
  });
  parseItemCanCastSpellEffects(source, cleanText, effects);
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

  return { source, effects };
}


export * from "@/domain/character/parseFeatureEffectsDerived";

