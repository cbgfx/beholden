import type { ParsedFeatureEffects, FeatureEffectSource } from "@/domain/character/featureEffects";
import { cleanupText } from "@/domain/character/parseFeatureEffects.normalizers";
import { parseSpellChoiceEffects } from "@/domain/character/parseFeatureEffects.choices";
import { parseItemCanCastSpellEffects, parseSpellGrantEffects } from "@/domain/character/parseFeatureEffects.grants";
import { parseResourceGrantEffects } from "@/domain/character/parseFeatureEffects.resources";
import { parseProficiencyGrantEffects } from "@/domain/character/parseFeatureEffects.proficiencies";
import { parseDefenseEffects } from "@/domain/character/parseFeatureEffects.defense";
import {
  parseAbilityScoreEffects,
  parseArmorClassBonusEffects,
  parseArmorClassEffects,
  parseAttackEffects,
  parseAdvantageModifierEffects,
  parseHitPointBonusEffects,
  parseInitiativeModifierEffects,
  parsePassiveScoreEffects,
  parseSavingThrowModifierEffects,
  parseSensesEffects,
  parseSpeedEffects,
  parseWeaponMasteryEffects,
} from "@/domain/character/parseFeatureEffects.parsers";

export interface ParseFeatureEffectsInput {
  source: FeatureEffectSource;
  text: string;
  suppressStructuredSpellGrants?: boolean;
}

export function parseFeatureEffects(input: ParseFeatureEffectsInput): ParsedFeatureEffects {
  const cleanText = cleanupText(input.text);
  const source: FeatureEffectSource = { ...input.source, text: cleanText };
  const effects: ParsedFeatureEffects["effects"] = [];

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
