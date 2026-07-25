import type { ParsedFeatureEffects } from "@/domain/character/featureEffects";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";
import {
  deriveArmorClassBonusFromEffects,
  deriveSpeedBonusFromEffects,
  deriveUnarmoredDefenseFromEffects,
} from "@/domain/character/parseFeatureEffects";

/**
 * Resolves the facts stored on a newly-built character from canonical feature effects.
 * No class/species names are inspected here: the compendium data is the rule source.
 */
export function deriveCreatorSheetFacts(args: {
  baseSpeed: number;
  level: number;
  scores: Record<string, number>;
  classFeatureEffects: ParsedFeatureEffects[];
  /** Species trait effects (e.g. Warforged's Integrated Protection) — same pipeline as class features, so the creator preview matches the saved sheet. */
  speciesTraitEffects?: ParsedFeatureEffects[];
}): { ac: number; speed: number } {
  const scores = Object.fromEntries(
    (["str", "dex", "con", "int", "wis", "cha"] as AbilKey[])
      .map((ability) => [ability, args.scores[ability] ?? 10]),
  ) as Record<AbilKey, number>;
  const allEffects = [...args.classFeatureEffects, ...(args.speciesTraitEffects ?? [])];
  const dexterityAc = 10 + Math.floor((scores.dex - 10) / 2);
  const unarmoredDefenseAc = deriveUnarmoredDefenseFromEffects(
    allEffects,
    scores,
    { armorEquipped: false, shieldEquipped: false },
  );
  const flatAcBonus = deriveArmorClassBonusFromEffects(allEffects, {
    armorEquipped: false,
    armorCategory: "none",
    level: args.level,
    scores,
  });
  const speedBonus = deriveSpeedBonusFromEffects(allEffects, {
    armorState: "no_armor",
    level: args.level,
  });

  return {
    ac: Math.max(dexterityAc, unarmoredDefenseAc ?? 0) + flatAcBonus,
    speed: args.baseSpeed + speedBonus,
  };
}
