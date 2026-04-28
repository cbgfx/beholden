import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import { titleCase as toTitleCase } from "@/lib/format/titleCase";
import {
  createFeatureEffectId,
  type ArmorClassEffect,
  type FeatureEffect,
  type FeatureEffectSource,
  type ModifierEffect,
} from "@/domain/character/featureEffects";
import {
  hasContextualQualifier,
  splitSkillNames,
} from "@/domain/character/parseFeatureEffects.normalizers";

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

const ABILITY_NAME_MAP: Record<string, AbilKey> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

export function parseInitiativeModifierEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
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

export function parseSavingThrowModifierEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
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

export function parseAdvantageModifierEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
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

export function parseArmorClassBonusEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
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
