import { z } from "zod";
import {
  nonnegInt,
  TraitSchema,
} from "./grandCompendiumSchemas.shared.js";

const compactChoice = z.union([
  z.array(z.string().min(1)).min(1),
  z.object({
    fixed: z.array(z.string().min(1)).min(1).optional(),
    choose: z.number().int().positive(),
    from: z.array(z.string().min(1)).min(1).optional(),
  }).strict(),
]);

export const EquipmentSchema = z.object({
  description: z.string().min(1).optional(),
  options: z.array(z.object({
    id: z.string().min(1),
    entries: z.array(z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("item"), itemId: z.string().regex(/^[a-z0-9_]+$/), quantity: z.number().int().positive(), sourceLabel: z.string().min(1).optional() }).strict(),
      z.object({ kind: z.literal("choiceRef"), choiceKey: z.enum(["background.tools", "class.tools"]), quantity: z.number().int().positive(), sourceLabel: z.string().min(1) }).strict(),
      z.object({ kind: z.literal("itemChoice"), choiceKey: z.string().min(1), itemIds: z.array(z.string().regex(/^[a-z0-9_]+$/)).min(2), quantity: z.number().int().positive(), sourceLabel: z.string().min(1) }).strict(),
      z.object({ kind: z.literal("currency"), denomination: z.enum(["PP", "GP", "EP", "SP", "CP"]), amount: nonnegInt }).strict(),
    ])).min(1),
  }).strict()).min(1).optional(),
}).strict().refine((equipment) => Boolean(equipment.description || equipment.options?.length), "Equipment must include a description or options.");

export const BackgroundSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    description: z.string(),
    proficiencies: z.object({
      skills: compactChoice.optional(),
      tools: compactChoice.optional(),
      languages: compactChoice.optional(),
      feat: z.string().regex(/^f_[a-z0-9_:'()]+$/u).optional(),
      featChoice: z.union([
        z.number().int().positive(),
        z.object({
          count: z.number().int().positive(),
          from: z.array(z.string().regex(/^f_[a-z0-9_:'()]+$/u)).min(2),
        }).strict(),
      ]).optional(),
      abilityScores: z.array(z.string().min(1)).min(1).optional(),
      abilityScoreChoose: z.number().int().positive().optional(),
    }).strict(),
    equipment: EquipmentSchema.optional(),
    /** Background traits share the species trait contract — including structured `effects`,
     * which the client's background-trait consumption already threads through. No canonical
     * 2024 background currently stores traits; the field exists for content that does. */
    traits: z.array(TraitSchema).min(1).optional(),
  })
  .strict();
