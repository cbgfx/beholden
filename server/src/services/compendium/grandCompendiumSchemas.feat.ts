import { z } from "zod";
import { FeatMechanicsSchema, RulesetSchema } from "./grandCompendiumSchemas.shared.js";

/** General is the canonical default and is omitted for compactness. */
export const FEAT_CATEGORIES = ["O", "E", "F"] as const;

const AbilityPrerequisiteSchema = z.object({
  any: z.array(z.enum(["str", "dex", "con", "int", "wis", "cha"])).min(1),
  /** 13 is the rules default and is omitted. */
  min: z.number().int().min(1).max(30).optional(),
}).strict();

const PrerequisiteAlternativeSchema = z.union([
  z.object({ feat: z.string().regex(/^f_/u) }).strict(),
  z.object({ feature: z.enum(["spellcasting", "fighting_style"]) }).strict(),
  z.object({ training: z.enum(["martial_weapon", "heavy_weapon", "light_armor", "medium_armor", "heavy_armor", "shield"]) }).strict(),
]);

export const FeatPrerequisiteSchema = z.union([
  z.number().int().min(1).max(20),
  z.object({
    level: z.number().int().min(1).max(20).optional(),
    ability: z.union([AbilityPrerequisiteSchema, z.array(AbilityPrerequisiteSchema).min(2)]).optional(),
    class: z.enum(["paladin"]).optional(),
    feature: z.enum(["spellcasting", "fighting_style"]).optional(),
    training: z.enum(["martial_weapon", "heavy_weapon", "light_armor", "medium_armor", "heavy_armor", "shield"]).optional(),
    feat: z.string().regex(/^f_/u).optional(),
    anyOfFeats: z.array(z.string().regex(/^f_/u)).min(1).optional(),
    noneOfFeats: z.array(z.string().regex(/^f_/u)).min(1).optional(),
    campaign: z.enum(["eberron"]).optional(),
    any: z.array(PrerequisiteAlternativeSchema).min(2).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, "Empty prerequisite must be omitted"),
]);

export const FeatSchema = z
  .object({
    id: z.string().min(1),
    ruleset: RulesetSchema,
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    category: z.enum(FEAT_CATEGORIES).optional(),
    prerequisite: FeatPrerequisiteSchema.optional(),
    repeatable: z.literal(true).optional(),
    description: z.string(),
    resolution: z.enum(["automatic", "manual", "mixed"]).optional(),
    resolutionNotes: z.array(z.string().min(1)).min(1).optional(),
    mechanics: FeatMechanicsSchema
      .refine((value) => Object.keys(value).length > 0, "Empty mechanics must be omitted")
      .optional(),
  })
  .strict();
