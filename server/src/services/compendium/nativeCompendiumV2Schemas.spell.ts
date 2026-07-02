import { z } from "zod";
const SpellRollSchema = z
  .object({
    formula: z.string().min(1),
    description: z.string().min(1).optional(),
    scaling: z.enum(["character_level", "slot_level"]).optional(),
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
    classes: z.array(z.string().min(1)).min(1).optional(),
    tags: z.array(z.string().min(1)).min(1).optional(),
    rolls: z.array(SpellRollSchema).min(1).optional(),
    description: z.array(z.string().min(1)).min(1),
  })
  .strict();
