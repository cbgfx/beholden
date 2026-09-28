import { z } from "zod";
import { CharacterLevelSchema, ClassTalentIdSchema, compendiumEntryFields, isNonEmptyObject, RollSchema, StructuredFeatureEffectSchema, TALENT_KIND } from "./grandCompendiumSchemas.shared.js";

export const ClassTalentSchema = z.object({
  ...compendiumEntryFields,
  id: ClassTalentIdSchema,
  kind: TALENT_KIND,
  prerequisite: z.object({
    level: CharacterLevelSchema.optional(),
    talent: ClassTalentIdSchema.optional(),
    cantrip: z.enum(["damage", "attack_damage"]).optional(),
    /** 2014-only: gates on a chosen Warlock Pact Boon. 5.5e represents Pact Boons as
     * invocations themselves and gates on `talent` instead — this field exists because 2014
     * Pact Boon is a separate class `choices` pick, not a `ct_` talent id. */
    pactBoon: z.enum(["blade", "chain", "tome", "talisman"]).optional(),
  }).strict().refine(isNonEmptyObject, "Empty prerequisite must be omitted").optional(),
  repeatable: z.literal(true).optional(),
  /** Deterministic mechanics consumed directly; description remains display/reference text only. */
  effects: z.array(StructuredFeatureEffectSchema).min(1).optional(),
  rolls: z.array(RollSchema).min(1).optional(),
  description: z.array(z.string().min(1)).min(1),
}).strict();
