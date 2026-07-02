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
  createRageGate,
  hasContextualQualifier,
  splitSkillNames,
} from "@/domain/character/parseFeatureEffects.normalizers";

const ABILITY_NAME_MAP: Record<string, AbilKey> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

export function parseInitiativeModifierEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const hasDirectInitiativePbText = /add your Proficiency Bonus to (?:your )?(?:the )?Initiative/i.test(text);
  const hasRollInitiativePbText = /\bwhen you roll initiative\b/i.test(text) && /\badd your proficiency bonus to (?:the )?roll\b/i.test(text);
  const hasFixedInitiativeBonusText = /\+\d+\s+(?:bonus\s+)?to (?:your\s+)?(?:initiative|initiative rolls?)\b/i.test(text);
  const hasAbilityInitiativeBonusText = /bonus to (?:your )?(?:initiative|initiative rolls?)(?: equal to| equals?| equal) your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/i.test(text);
  const hasExplicitInitiativeBonusText = hasDirectInitiativePbText || hasRollInitiativePbText || hasFixedInitiativeBonusText || hasAbilityInitiativeBonusText;
  const isAlertNameFallback = /\balert\b/i.test(source.name) && (!text || (/\binitiative\b/i.test(text) && !hasExplicitInitiativeBonusText));
  if (hasDirectInitiativePbText || hasRollInitiativePbText || isAlertNameFallback) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier", source,
      target: "initiative", mode: "bonus",
      amount: { kind: "proficiency_bonus" },
      summary: "Add Proficiency Bonus to Initiative",
    } satisfies ModifierEffect);
  }

  for (const match of text.matchAll(/\+(\d+)\s+(?:bonus\s+)?to (?:your\s+)?(?:initiative|initiative rolls?)\b/gi)) {
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "initiative",
      mode: "bonus",
      amount: { kind: "fixed", value },
      summary: `+${value} Initiative`,
    } satisfies ModifierEffect);
  }

  for (const match of text.matchAll(/bonus to (?:your )?(?:initiative|initiative rolls?)(?: equal to| equals?| equal) your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier/gi)) {
    const ability = ABILITY_NAME_MAP[match[1].toLowerCase()];
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "initiative",
      mode: "bonus",
      amount: { kind: "ability_mod", ability },
      summary: `Add ${ability.toUpperCase()} modifier to Initiative`,
    } satisfies ModifierEffect);
  }

  // "When you roll Initiative, you can add your Wisdom modifier to the roll." (e.g. Dread Ambusher)
  for (const match of text.matchAll(/\bwhen you roll initiative\b[^.]*?\badd your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier to (?:the )?roll\b/gi)) {
    const ability = ABILITY_NAME_MAP[match[1].toLowerCase()];
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "initiative",
      mode: "bonus",
      amount: { kind: "ability_mod", ability },
      summary: `Add ${ability.toUpperCase()} modifier to Initiative`,
    } satisfies ModifierEffect);
  }

  for (const match of text.matchAll(/\badd your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier to (?:your )?initiative rolls?\b/gi)) {
    const ability = ABILITY_NAME_MAP[match[1].toLowerCase()];
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "initiative",
      mode: "bonus",
      amount: { kind: "ability_mod", ability },
      summary: `Add ${ability.toUpperCase()} modifier to Initiative`,
    } satisfies ModifierEffect);
  }

  if (
    /\bdread ambusher\b/i.test(source.name)
    && /\binitiative\b/i.test(text)
    && /\bwisdom modifier\b/i.test(text)
    && !effects.some((effect) =>
      effect.type === "modifier"
      && effect.target === "initiative"
      && effect.mode === "bonus"
      && effect.amount?.kind === "ability_mod"
      && effect.amount.ability === "wis"
    )
  ) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "initiative",
      mode: "bonus",
      amount: { kind: "ability_mod", ability: "wis" },
      summary: "Add WIS modifier to Initiative",
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

export function parseSkillCheckBonusEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  for (const match of text.matchAll(/bonus to your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s*\(([^)]+)\)\s+checks?\.?\s+The bonus equals your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) modifier(?:\s*\(minimum (?:bonus )?of \+?(\d+)\))?/gi)) {
    const skillNames = splitSkillNames(match[2]);
    const amountAbility = ABILITY_NAME_MAP[match[3].toLowerCase()];
    const min = match[4] ? Number(match[4]) : undefined;
    if (skillNames.length === 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "skill_check",
      mode: "bonus",
      amount: { kind: "ability_mod", ability: amountAbility, ...(min != null ? { min } : {}) },
      appliesTo: skillNames,
      summary: `Add ${amountAbility.toUpperCase()} modifier to ${skillNames.join(", ")} checks`,
    } satisfies ModifierEffect);
  }
}

export function parseSpellSaveDcModifierEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  for (const match of text.matchAll(/\+(\d+)\s+bonus to (?:the )?(?:saving throw DC|spell save DC|save DC)(?: of your [A-Za-z]+ spells?)?/gi)) {
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier",
      source,
      target: "spell_save_dc",
      mode: "bonus",
      amount: { kind: "fixed", value },
      summary: `+${value} spell save DC`,
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

export function parseAttackRollBonusEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  // Archery Fighting Style: +N to attack rolls with Ranged weapons
  for (const match of text.matchAll(/\+(\d+)\s+(?:bonus\s+)?to (?:attack rolls?|attack rolls? you make)\s+with\s+(?:a\s+)?Ranged weapons?/gi)) {
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier", source, target: "attack_roll", mode: "bonus",
      amount: { kind: "fixed", value },
      gate: { weaponFilters: ["ranged_weapon"] },
      summary: `+${value} to attack rolls with Ranged weapons`,
    } satisfies ModifierEffect);
  }
}

export function parseDamageRollBonusEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  // Dueling: +2 to damage rolls when wielding a melee weapon in one hand and no other weapons
  const duelingMatch =
    text.match(/\+(\d+)\s+(?:bonus\s+)?to (?:your\s+)?damage rolls?\s+when(?:ever)?\s+you are wielding a (?:melee\s+)?weapon in one hand and no other weapons/i)
    ?? text.match(/holding a (?:melee\s+)?weapon in one hand and no other weapons[^.]*?\+(\d+)\s+bonus to damage rolls?/i);
  if (duelingMatch) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier", source, target: "damage_roll", mode: "bonus",
      amount: { kind: "fixed", value: Number(duelingMatch[1]) },
      gate: { weaponFilters: ["melee_weapon", "no_offhand", "no_two_handed"] },
      summary: `+${duelingMatch[1]} damage (one melee weapon, no offhand)`,
    } satisfies ModifierEffect);
    return;
  }

  // Thrown Weapon Fighting: +2 to damage rolls with thrown weapons
  const thrownMatch =
    text.match(/\+(\d+)\s+(?:bonus\s+)?to (?:your\s+)?damage rolls?\s+(?:you make\s+)?with (?:the\s+)?thrown (?:weapon|property)/i)
    ?? text.match(/weapon that has the Thrown property[^.]*?\+(\d+)\s+bonus to (?:the\s+)?damage roll/i);
  if (thrownMatch) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier", source, target: "damage_roll", mode: "bonus",
      amount: { kind: "fixed", value: Number(thrownMatch[1]) },
      gate: { weaponFilters: ["thrown_weapon"] },
      summary: `+${thrownMatch[1]} damage with thrown weapons`,
    } satisfies ModifierEffect);
  }

  // Great Weapon Fighting: reroll 1s and 2s on damage dice with two-handed or versatile weapons
  if (/reroll\b[^.]*?\b(?:1|a 1|one)\b[^.]*?\bor\b[^.]*?\b(?:2|a 2|two)\b[^.]*?\b(?:two.?handed|versatile)/i.test(text)
    || /when you roll a 1 or 2 on a damage die\b[^.]*?\bwith a (?:two.?handed|versatile)/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier", source, target: "damage_roll", mode: "reroll",
      gate: { notes: "two_handed_or_versatile" },
      summary: "Reroll 1s and 2s on damage dice (two-handed/versatile weapons)",
    } satisfies ModifierEffect);
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
