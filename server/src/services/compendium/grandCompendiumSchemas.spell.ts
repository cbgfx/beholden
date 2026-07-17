import { z } from "zod";
const SpellRollSchema = z
  .object({
    formula: z.string().min(1),
    effect: z.union([z.enum([
      "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
      "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
      "healing", "temp_hp",
    ]), z.array(z.enum([
      "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
      "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
    ])).min(2)]).optional(),
    description: z.string().min(1).optional(),
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
  .refine((value) => Object.keys(value).length > 0, "Empty components must be omitted");

const SpellDurationSchema = z
  .object({
    description: z.string().min(1).optional(),
    concentration: z.literal(true).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Empty duration must be omitted");

export const SpellSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    level: z.number().int().min(0).max(9).optional(),
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
      .refine((value) => Object.keys(value).length > 0, "Empty casting data must be omitted")
      .optional(),
    ritual: z.literal(true).optional(),
    access: z.array(z.string().regex(/^sl_[a-z0-9_]+$/u)).min(1).optional(),
    check: z.union([
      z.enum(["attack", "str", "dex", "con", "int", "wis", "cha"]),
      z.array(z.enum(["attack", "str", "dex", "con", "int", "wis", "cha"])).min(2),
    ]).optional(),
    rolls: z.array(SpellRollSchema).min(1).optional(),
    description: z.array(z.string().min(1)).min(1),
  })
  .strict();
