import { z } from "zod";
import {
  nonnegInt,
  SIZE,
  ABILITY,
  SpeciesChoiceSchema,
  TraitSchema,
} from "./nativeCompendiumV2Schemas.shared.js";

export const SpeciesSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    size: SIZE.optional(),
    speed: nonnegInt,
    spellcastingAbility: ABILITY.optional(),
    resistances: z.array(z.string().min(1)).min(1).optional(),
    vision: z.array(
      z.object({ type: z.string().min(1).optional(), range: nonnegInt.optional() }).strict(),
    ),
    choices: SpeciesChoiceSchema
      .refine((value) => Object.keys(value).length > 0, "Empty choices must be omitted")
      .optional(),
    traits: z.array(TraitSchema),
  })
  .strict();
