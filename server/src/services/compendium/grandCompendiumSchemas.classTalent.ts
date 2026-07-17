import { z } from "zod";
import { StructuredFeatureEffectSchema } from "./grandCompendiumSchemas.shared.js";

const ClassTalentRollSchema = z.object({
  formula: z.string().min(1),
  description: z.string().min(1).optional(),
}).strict();

export const ClassTalentSchema = z.object({
  id: z.string().regex(/^ct_[a-z0-9_]+$/u, "ClassTalent IDs must use the canonical ct_ prefix"),
  name: z.string().min(1),
  source: z.string().min(1).optional(),
  kind: z.enum(["invocation", "maneuver", "metamagic"]),
  prerequisite: z.object({
    level: z.number().int().min(1).max(20).optional(),
    talent: z.string().regex(/^ct_[a-z0-9_]+$/u).optional(),
    cantrip: z.enum(["damage", "attack_damage"]).optional(),
  }).strict().refine((value) => Object.keys(value).length > 0, "Empty prerequisite must be omitted").optional(),
  repeatable: z.literal(true).optional(),
  /** Deterministic mechanics consumed directly; description remains display/reference text only. */
  effects: z.array(StructuredFeatureEffectSchema).min(1).optional(),
  rolls: z.array(ClassTalentRollSchema).min(1).optional(),
  description: z.array(z.string().min(1)).min(1),
}).strict();
