import { z } from "zod";
import {
  nonnegInt,
  SIZE,
  ABILITY,
  isNonEmptyObject,
  SpeciesChoiceSchema,
  TraitSchema,
  compendiumEntryFields,
  abilityShape,
} from "./grandCompendiumSchemas.shared.js";

export const SpeciesSchema = z
  .object({
    ...compendiumEntryFields,
    size: SIZE.optional(),
    speed: nonnegInt,
    /** Omit when Humanoid (the documented default for every 2024 species but Warforged). */
    creatureType: z.string().min(1).optional(),
    spellcastingAbility: ABILITY.optional(),
    /** Fixed 2014-race Ability Score Increase amounts (e.g. Dwarf: `{con: 2, wis: 1}`).
     * Player-chosen amounts on top of this live on `choices.abilityScoreChoice`. Omit entirely
     * for a 2024 species, which grants no ability score increase of its own. */
    abilityScoreIncrease: z.object(abilityShape(z.number().int())).strict()
      .refine(isNonEmptyObject, "Empty abilityScoreIncrease must be omitted")
      .optional(),
    choices: SpeciesChoiceSchema
      .refine(isNonEmptyObject, "Empty choices must be omitted")
      .optional(),
    traits: z.array(TraitSchema),
  })
  .strict();
