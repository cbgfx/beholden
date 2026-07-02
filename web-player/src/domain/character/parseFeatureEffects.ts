import type { ParsedFeatureEffects, FeatureEffectSource } from "@/domain/character/featureEffects";
import { cleanupText } from "@/domain/character/parseFeatureEffects.normalizers";
import { parseSpellChoiceEffects } from "@/domain/character/parseFeatureEffects.choices";
import { parseAttackEffects, parseWeaponMasteryEffects } from "@/domain/character/parseFeatureEffects.combat";
import {
  parseAdvantageModifierEffects,
  parseArmorClassBonusEffects,
  parseAttackRollBonusEffects,
  parseDamageRollBonusEffects,
  parseInitiativeModifierEffects,
  parseSavingThrowModifierEffects,
  parseSkillCheckBonusEffects,
  parseSpellSaveDcModifierEffects,
} from "@/domain/character/parseFeatureEffects.modifiers";
import { parseItemCanCastSpellEffects, parseSpellGrantEffects } from "@/domain/character/parseFeatureEffects.grants";
import { parseResourceGrantEffects } from "@/domain/character/parseFeatureEffects.resources";
import { parseProficiencyGrantEffects } from "@/domain/character/parseFeatureEffects.proficiencies";
import { parseDefenseEffects } from "@/domain/character/parseFeatureEffects.defense";
import {
  parseAbilityScoreEffects,
  parseArmorClassEffects,
  parseHitPointBonusEffects,
  parsePassiveScoreEffects,
  parseSensesEffects,
  parseSpeedEffects,
} from "@/domain/character/parseFeatureEffects.stats";
import {
  structuredEffectsFromCanonical,
  type StructuredFeatMechanicsLike,
} from "@/domain/character/structuredFeatureEffects";

export interface ParseFeatureEffectsInput {
  source: FeatureEffectSource;
  text: string;
  suppressStructuredSpellGrants?: boolean;
  classEffects?: unknown[];
  featMechanics?: StructuredFeatMechanicsLike | null;
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
  parseAttackRollBonusEffects(source, cleanText, effects);
  parseDamageRollBonusEffects(source, cleanText, effects);
  parseHitPointBonusEffects(source, cleanText, effects);
  parseAttackEffects(source, cleanText, effects);
  parseInitiativeModifierEffects(source, cleanText, effects);
  parseSavingThrowModifierEffects(source, cleanText, effects);
  parseSkillCheckBonusEffects(source, cleanText, effects);
  parseSpellSaveDcModifierEffects(source, cleanText, effects);
  parseAdvantageModifierEffects(source, cleanText, effects);
  parseSensesEffects(source, cleanText, effects);
  parsePassiveScoreEffects(source, cleanText, effects);

  const structuredEffects = structuredEffectsFromCanonical({
    source,
    classEffects: input.classEffects,
    featMechanics: input.featMechanics,
  });
  // Existing prose parsers sometimes carry conditions that legacy modifier
  // fields do not (for example, "while not wearing heavy armor"). Prefer that
  // richer result when available; structured data fills mechanic types prose
  // did not understand.
  const proseTypes = new Set(effects.map((effect) => effect.type));
  const structuredFallbacks = structuredEffects.filter((effect) => !proseTypes.has(effect.type));

  return { source, effects: [...effects, ...structuredFallbacks] };
}

export * from "@/domain/character/parseFeatureEffectsDerived";
