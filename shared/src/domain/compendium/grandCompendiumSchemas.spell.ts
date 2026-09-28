import { z } from "zod";
import { compendiumEntryFields, isNonEmptyObject, RollSchema, SpellLevelSchema, SpellListIdSchema } from "./grandCompendiumSchemas.shared.js";
const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
] as const;
const DAMAGE_TYPE = z.enum(DAMAGE_TYPES);
const SpellRollSchema = z
  .object({
    ...RollSchema.shape,
    effect: z.union([z.enum([...DAMAGE_TYPES, "healing", "temp_hp"]), z.array(DAMAGE_TYPE).min(2)]).optional(),
    // Scaling basis is derived, never stored: a cantrip's rows are character-level tiers,
    // a leveled spell's rows are slot-keyed. (`spell.level === 0` decides.)
    level: z.number().int().min(0).max(20).optional(),
  })
  .strict();

const SpellComponentsSchema = z
  .object({
    verbal: z.literal(true).optional(),
    somatic: z.literal(true).optional(),
    material: z.union([z.literal(true), z.string().min(1)]).optional(),
  })
  .strict()
  .refine(isNonEmptyObject, "Empty components must be omitted");

const SpellDurationSchema = z
  .object({
    description: z.string().min(1).optional(),
    concentration: z.literal(true).optional(),
  })
  .strict()
  .refine(isNonEmptyObject, "Empty duration must be omitted");

export const SpellSchema = z
  .object({
    ...compendiumEntryFields,
    level: SpellLevelSchema.optional(),
    school: z.enum([
      "Abjuration",
      "Conjuration",
      "Divination",
      "Enchantment",
      "Evocation",
      "Illusion",
      "Necromancy",
      "Transmutation",
    ]).optional(),
    casting: z
      .object({
        time: z.string().min(1).optional(),
        range: z.string().min(1).optional(),
        components: SpellComponentsSchema.optional(),
        duration: SpellDurationSchema.optional(),
      })
      .strict()
      .refine(isNonEmptyObject, "Empty casting data must be omitted")
      .optional(),
    ritual: z.literal(true).optional(),
    access: z.array(SpellListIdSchema).min(1).optional(),
    check: z.enum(["attack", "str", "dex", "con", "int", "wis", "cha"]).optional(),
    rolls: z.array(SpellRollSchema).min(1).optional(),
    description: z.array(z.string().min(1)).min(1),
  })
  .strict();
