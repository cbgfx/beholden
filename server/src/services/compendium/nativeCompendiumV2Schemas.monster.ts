import { z } from "zod";
import { nonnegInt, SIZE, checkUniqueIds } from "./nativeCompendiumV2Schemas.shared.js";

const NamedBonusSchema = z
  .object({
    name: z.string().min(1),
    bonus: z.number().optional(),
  })
  .strict();

const AttackSchema = z
  .object({
    toHit: z.number(),
    reach: z.string().min(1).optional(),
    range: z.string().min(1).optional(),
    melee: z.literal(true).optional(),
    ranged: z.literal(true).optional(),
    damage: z.string().min(1).optional(),
    damageType: z.string().min(1).optional(),
  })
  .strict();

const RechargeSchema = z
  .object({
    kind: z.enum(["roll", "uses", "rest", "special"]),
    minimumRoll: z.number().int().min(1).max(6).optional(),
    uses: nonnegInt.optional(),
    period: z.enum(["day", "turn", "short_rest", "long_rest"]).optional(),
    source: z.string().min(1),
  })
  .strict();

const ActionEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    category: z.string().min(1).optional(),
    recharge: RechargeSchema.optional(),
    spellSlots: z.record(z.string(), nonnegInt).optional(),
    attack: AttackSchema.optional(),
    attacks: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();

export const MonsterSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    classification: z
      .object({
        size: SIZE.optional(),
        type: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        sortName: z.string().min(1).optional(),
        alignment: z.string().min(1).optional(),
        ancestry: z.string().min(1).optional(),
        environment: z.array(z.string().min(1)).min(1).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    description: z.string().min(1).optional(),
    initiativeBonus: z.number().int().optional(),
    passivePerception: nonnegInt.optional(),
    npc: z.literal(true).optional(),
    challenge: z
      .object({
        rating: z.string().min(1).optional(),
        numeric: z.number().optional(),
        xp: z.number().min(0).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    armorClass: z
      .object({
        value: nonnegInt,
        source: z.string().min(1).optional(),
      })
      .strict(),
    hitPoints: z
      .object({
        average: nonnegInt,
        formula: z.string().min(1).optional(),
      })
      .strict(),
    movement: z
      .object({
        walk: nonnegInt.optional(),
        burrow: nonnegInt.optional(),
        climb: nonnegInt.optional(),
        fly: nonnegInt.optional(),
        swim: nonnegInt.optional(),
        hover: z.literal(true).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    abilities: z
      .object({
        str: z.number().int().min(1).max(30).optional(),
        dex: z.number().int().min(1).max(30).optional(),
        con: z.number().int().min(1).max(30).optional(),
        int: z.number().int().min(1).max(30).optional(),
        wis: z.number().int().min(1).max(30).optional(),
        cha: z.number().int().min(1).max(30).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    proficiencies: z
      .object({
        savingThrows: z.array(NamedBonusSchema).min(1).optional(),
        skills: z.array(NamedBonusSchema).min(1).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    defenses: z
      .object({
        vulnerabilities: z.array(z.string().min(1)).min(1).optional(),
        resistances: z.array(z.string().min(1)).min(1).optional(),
        damageImmunities: z.array(z.string().min(1)).min(1).optional(),
        conditionImmunities: z.array(z.string().min(1)).min(1).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    senses: z.array(z.string().min(1)).min(1).optional(),
    languages: z.array(z.string().min(1)).min(1).optional(),
    traits: z.array(ActionEntrySchema).min(1).optional(),
    actions: z.array(ActionEntrySchema).min(1).optional(),
    reactions: z.array(ActionEntrySchema).min(1).optional(),
    legendaryActions: z.array(ActionEntrySchema).min(1).optional(),
    spellcasting: z.array(ActionEntrySchema).min(1).optional(),
    spells: z.array(
      z.object({ id: z.string().min(1).optional(), name: z.string().min(1).optional() })
        .strict()
        .refine((value) => value.id !== undefined || value.name !== undefined),
    ).min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    checkUniqueIds(data.traits ?? [], ctx, "traits");
    checkUniqueIds(data.actions ?? [], ctx, "actions");
    checkUniqueIds(data.reactions ?? [], ctx, "reactions");
    checkUniqueIds(data.legendaryActions ?? [], ctx, "legendaryActions");
    checkUniqueIds(data.spellcasting ?? [], ctx, "spellcasting");
  });
