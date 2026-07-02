import { z } from "zod";
import {
  nonnegInt,
  ABILITY,
  FeatChoiceSchema,
  PreparedSpellProgressionSchema,
  StructuredFeatureEffectSchema,
} from "./nativeCompendiumV2Schemas.shared.js";

const compactChoice = z.union([
  z.array(z.string().min(1)).min(1),
  z.object({
    fixed: z.array(z.string().min(1)).min(1).optional(),
    choose: z.number().int().positive(),
    from: z.array(z.string().min(1)).min(1).optional(),
  }).strict(),
]);

const CompactScalingRollSchema = z.object({
  description: z.string().min(1).optional(),
  level: z.number().int().min(1).max(20).optional(),
  formula: z.string().min(1),
}).strict();

const CompactFeatMechanicsSchema = z.object({
  resolution: z.enum(["automatic", "manual", "mixed"]).optional(),
  resolutionNotes: z.array(z.string().min(1)).min(1).optional(),
  category: z.string().min(1).optional(),
  baseName: z.string().min(1).optional(),
  variant: z.string().min(1).optional(),
  prerequisite: z.string().min(1).optional(),
  repeatable: z.literal(true).optional(),
  source: z.string().min(1).optional(),
  grants: z.object({
    skills: z.array(z.string().min(1)).min(1).optional(),
    tools: z.array(z.string().min(1)).min(1).optional(),
    languages: z.array(z.string().min(1)).min(1).optional(),
    armor: z.array(z.string().min(1)).min(1).optional(),
    weapons: z.array(z.string().min(1)).min(1).optional(),
    savingThrows: z.array(z.string().min(1)).min(1).optional(),
    spells: z.array(z.string().min(1)).min(1).optional(),
    cantrips: z.array(z.string().min(1)).min(1).optional(),
    abilityIncreases: z.record(z.string(), z.number()).refine(
      (value) => Object.keys(value).length > 0,
      "abilityIncreases must not be empty.",
    ).optional(),
    bonuses: z.array(z.object({ target: z.string(), value: z.number() }).strict()).min(1).optional(),
    effects: z.array(StructuredFeatureEffectSchema).min(1).optional(),
  }).strict().optional(),
  choices: z.array(FeatChoiceSchema.extend({
    options: z.array(z.string()).optional(),
  })).min(1).optional(),
  uses: z.array(z.object({
    count: nonnegInt,
    countFrom: z.enum(["proficiency_bonus", "ability_modifier"]).optional(),
    ability: z.string().optional(),
    minimum: z.number().optional(),
    recharge: z.enum(["short_rest", "long_rest", "short_or_long_rest"]).optional(),
    note: z.string(),
  }).strict()).min(1).optional(),
  preparedSpellProgression: z.array(PreparedSpellProgressionSchema).min(1).optional(),
  notes: z.array(z.string().min(1)).min(1).optional(),
  modifierDetails: z.array(z.object({
    category: z.string(),
    text: z.string(),
    target: z.string().optional(),
    value: z.number().optional(),
  }).strict()).min(1).optional(),
  spellcastingAbility: ABILITY.optional(),
  spellcastingAbilityFromChoiceId: z.string().min(1).optional(),
}).strict();

export const BackgroundSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    description: z.string(),
    proficiencies: z.object({
      skills: compactChoice.optional(),
      tools: compactChoice.optional(),
      languages: compactChoice.optional(),
      feats: z.array(z.object({
        name: z.string().min(1),
        description: z.string().min(1).optional(),
        parsed: CompactFeatMechanicsSchema,
        scalingRolls: z.array(CompactScalingRollSchema).min(1).optional(),
        preparedSpellProgression: z.array(PreparedSpellProgressionSchema).min(1).optional(),
        resolution: z.enum(["automatic", "manual", "mixed"]).optional(),
      }).strict()).min(1).optional(),
      featChoice: z.number().int().positive().optional(),
      abilityScores: z.array(z.string().min(1)).min(1).optional(),
      abilityScoreChoose: z.number().int().positive().optional(),
    }).strict(),
    equipment: z.object({
      description: z.string().min(1).optional(),
      options: z.array(z.object({
        id: z.string().min(1),
        entries: z.array(z.discriminatedUnion("kind", [
          z.object({
            kind: z.literal("item"),
            name: z.string().min(1),
            quantity: z.number().int().positive(),
          }).strict(),
          z.object({
            kind: z.literal("currency"),
            denomination: z.enum(["PP", "GP", "EP", "SP", "CP"]),
            amount: nonnegInt,
          }).strict(),
        ])),
      }).strict()).min(1).optional(),
    }).strict().refine(
      (equipment) => Boolean(equipment.description || equipment.options?.length),
      "Equipment must include a description or options.",
    ).optional(),
    traits: z.array(z.object({
      name: z.string().min(1),
      description: z.string(),
      scalingRolls: z.array(CompactScalingRollSchema).min(1).optional(),
      preparedSpellProgression: z.array(PreparedSpellProgressionSchema).min(1).optional(),
      resolution: z.enum(["automatic", "manual", "mixed"]).optional(),
    }).strict()).min(1).optional(),
  })
  .strict();
