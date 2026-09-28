import {
  deriveHitPointMaxBonusFromEffects,
  parseFeatureEffects,
} from "@/domain/character/parseFeatureEffects";
import type { StructuredFeatMechanicsLike } from "@/domain/character/structuredFeatureEffects";

export interface FeatEffectDetailLike {
  id?: string | null;
  name: string;
  text?: string | null;
  parsed?: StructuredFeatMechanicsLike | null;
}

export function deriveFeatHitPointMaxBonus(
  feats: Array<FeatEffectDetailLike | null | undefined>,
  level: number,
): number {
  const parsed = feats.flatMap((feat, index) => {
    if (!feat) return [];
    return [parseFeatureEffects({
      source: {
        id: feat.id ?? `feat:${index}`,
        kind: "feat",
        name: feat.name,
        text: feat.text ?? "",
      },
      text: feat.text ?? "",
      featMechanics: feat.parsed,
    })];
  });

  return deriveHitPointMaxBonusFromEffects(parsed, { level });
}
