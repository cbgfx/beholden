import { z } from "zod";
import {
  nonnegInt,
  SIZE,
  ABILITY,
  SpeciesChoiceSchema,
  TraitSchema,
  RulesetSchema,
} from "./grandCompendiumSchemas.shared.js";

export const SpeciesSchema = z
  .object({
    id: z.string().min(1),
    ruleset: RulesetSchema,
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    size: SIZE.optional(),
    speed: nonnegInt,
    /** Omit when Humanoid (the documented default for every 2024 species but Warforged). */
    creatureType: z.string().min(1).optional(),
    spellcastingAbility: ABILITY.optional(),
    /** Fixed 2014-race Ability Score Increase amounts (e.g. Dwarf: `{con: 2, wis: 1}`).
     * Player-chosen amounts on top of this live on `choices.abilityScoreChoice`. Omit entirely
     * for a 2024 species, which grants no ability score increase of its own. */
    abilityScoreIncrease: z.object({
      str: z.number().int().optional(),
      dex: z.number().int().optional(),
      con: z.number().int().optional(),
      int: z.number().int().optional(),
      wis: z.number().int().optional(),
      cha: z.number().int().optional(),
    }).strict()
      .refine((value) => Object.keys(value).length > 0, "Empty abilityScoreIncrease must be omitted")
      .optional(),
    choices: SpeciesChoiceSchema
      .refine((value) => Object.keys(value).length > 0, "Empty choices must be omitted")
      .optional(),
    traits: z.array(TraitSchema),
  })
  .strict();
