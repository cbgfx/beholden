import { z } from "zod";
import { nonnegInt } from "./nativeCompendiumV2Schemas.shared.js";

const ModifierSchema = z
  .object({
    category: z.string(),
    value: z.string(),
  })
  .strict();

const ItemRollSchema = z
  .object({
    formula: z.string().min(1),
    description: z.string().min(1).optional(),
  })
  .strict();

export const ItemSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    type: z.string().min(1),
    rarity: z.string().min(1),
    magical: z.literal(true).optional(),
    attunement: z.union([z.literal(true), z.string().min(1)]).optional(),
    equippable: z.literal(true).optional(),
    weight: z.number().min(0).optional(),
    value: z.number().min(0).optional(),
    proficiency: z.string().min(1).optional(),
    armor: z
      .object({
        ac: nonnegInt.optional(),
        stealthDisadvantage: z.literal(true).optional(),
        strength: nonnegInt.optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    weapon: z
      .object({
        damage: z.string().min(1).optional(),
        twoHandedDamage: z.string().min(1).optional(),
        damageType: z.string().min(1).optional(),
        range: z.string().min(1).optional(),
        properties: z.array(z.string().min(1)).min(1).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    detail: z.string().min(1).optional(),
    modifiers: z.array(ModifierSchema).min(1).optional(),
    rolls: z.array(ItemRollSchema).min(1).optional(),
    description: z.union([z.string(), z.array(z.string()).min(1)]),
  })
  .strict();
