import { z } from "zod";
import {
  nonnegInt,
  SIZE,
  ABILITY,
  SpeciesChoiceSchema,
  TraitSchema,
} from "./grandCompendiumSchemas.shared.js";

export const SpeciesSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    size: SIZE.optional(),
    speed: nonnegInt,
    /** Omit when Humanoid (the documented default for every 2024 species but Warforged). */
    creatureType: z.string().min(1).optional(),
    spellcastingAbility: ABILITY.optional(),
    choices: SpeciesChoiceSchema
      .refine((value) => Object.keys(value).length > 0, "Empty choices must be omitted")
      .optional(),
    traits: z.array(TraitSchema),
  })
  .strict();
