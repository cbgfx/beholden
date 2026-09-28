import { z } from "zod";
import { ABILITY, CharacterLevelSchema, compendiumEntryFields, FEAT_FEATURE, FEAT_TRAINING, FeatIdSchema, FeatMechanicsSchema, isNonEmptyObject, resolutionFields } from "./grandCompendiumSchemas.shared.js";

/** General is the canonical default and is omitted for compactness. */
const FEAT_CATEGORIES = ["O", "E", "F"] as const;

const AbilityPrerequisiteSchema = z.object({
  any: z.array(ABILITY).min(1),
  /** 13 is the rules default and is omitted. */
  min: z.number().int().min(1).max(30).optional(),
}).strict();

const PrerequisiteAlternativeSchema = z.union([
  z.object({ feat: FeatIdSchema }).strict(),
  z.object({ feature: FEAT_FEATURE }).strict(),
  z.object({ training: FEAT_TRAINING }).strict(),
]);

const FeatPrerequisiteSchema = z.union([
  z.string().min(1),
  CharacterLevelSchema,
  z.object({
    level: CharacterLevelSchema.optional(),
    ability: z.union([AbilityPrerequisiteSchema, z.array(AbilityPrerequisiteSchema).min(2)]).optional(),
    class: z.enum(["paladin"]).optional(),
    feature: FEAT_FEATURE.optional(),
    training: FEAT_TRAINING.optional(),
    feat: FeatIdSchema.optional(),
    anyOfFeats: z.array(FeatIdSchema).min(1).optional(),
    noneOfFeats: z.array(FeatIdSchema).min(1).optional(),
    campaign: z.enum(["eberron"]).optional(),
    any: z.array(PrerequisiteAlternativeSchema).min(2).optional(),
  }).strict().refine(isNonEmptyObject, "Empty prerequisite must be omitted"),
]);

export const FeatSchema = z
  .object({
    ...compendiumEntryFields,
    category: z.enum(FEAT_CATEGORIES).optional(),
    prerequisite: FeatPrerequisiteSchema.optional(),
    repeatable: z.literal(true).optional(),
    description: z.string(),
    ...resolutionFields,
    mechanics: FeatMechanicsSchema
      .refine(isNonEmptyObject, "Empty mechanics must be omitted")
      .optional(),
  })
  .strict();
