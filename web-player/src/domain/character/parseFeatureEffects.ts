import type { ParsedFeatureEffects, FeatureEffectSource } from "@/domain/character/featureEffects";
import {
  structuredEffectsFromCanonical,
  type StructuredFeatMechanicsLike,
} from "@/domain/character/structuredFeatureEffects";

export interface ParseFeatureEffectsInput {
  source: FeatureEffectSource;
  text: string;
  /** Retained for persisted/caller compatibility; structured facts are always the only input. */
  suppressStructuredSpellGrants?: boolean;
  classEffects?: unknown[];
  classChoices?: unknown[];
  /** Verbatim FeatureEffect-shaped facts from a trait's own `effects` field (species/background traits). */
  traitEffects?: unknown[];
  featMechanics?: StructuredFeatMechanicsLike | null;
}

export function parseFeatureEffects(input: ParseFeatureEffectsInput): ParsedFeatureEffects {
  const cleanText = String(input.text ?? "").replace(/\s+/g, " ").trim();
  const source: FeatureEffectSource = { ...input.source, text: cleanText };
  const effects: ParsedFeatureEffects["effects"] = [];

  const structuredEffects = structuredEffectsFromCanonical({
    source,
    classEffects: input.classEffects,
    classChoices: input.classChoices,
    traitEffects: input.traitEffects,
    featMechanics: input.featMechanics,
  });
  effects.push(...structuredEffects);
  return { source, effects };
}

export * from "@/domain/character/parseFeatureEffectsDerived";
