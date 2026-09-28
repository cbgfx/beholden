import { z } from "zod";
import { CharacterLevelSchema, nonnegInt, RulesetSchema } from "./grandCompendiumSchemas.shared.js";

export const DeckSchema = z
  .object({
    ruleset: RulesetSchema,
    id: z.string().min(1),
    deckName: z.string().min(1),
    deckKey: z.string().min(1),
    cardName: z.string().min(1),
    cardKey: z.string().min(1),
    text: z.string(),
    sort: z.number().int(),
  })
  .strict();

/** A gold cost, with the book's build time where it gives one (shown only; time is handled at the table). */
const BastionBuildCostSchema = z
  .object({
    costGp: nonnegInt,
    days: nonnegInt.nullable().optional(),
  })
  .strict();

/** Upgrading a basic facility from this size to the next. */
const BastionBasicUpgradeSchema = z
  .object({
    to: z.string().min(1),
    costGp: nonnegInt,
    days: nonnegInt.nullable().optional(),
  })
  .strict();

/** A special facility's enlargement: gold only, plus what it gives. */
const BastionFacilityUpgradeSchema = z
  .object({
    to: z.string().min(1),
    costGp: nonnegInt,
    hirelingsDelta: z.number().int().optional(),
    summary: z.string().optional(),
  })
  .strict();

/** Bastion-wide rules. For now only the special facility slot progression. */
const BastionRulesSchema = z
  .object({
    ruleset: RulesetSchema,
    kind: z.literal("rules"),
    id: z.string().min(1),
    name: z.string().min(1),
    nameKey: z.string().min(1).optional(),
    specialFacilitySlots: z
      .array(z.object({ level: CharacterLevelSchema, count: nonnegInt }).strict())
      .min(1),
  })
  .strict();

const BastionSpaceSchema = z
  .object({
    ruleset: RulesetSchema,
    kind: z.literal("space"),
    id: z.string().min(1),
    name: z.string().min(1),
    squares: z.number().int().min(1),
    sort: z.number().int(),
    nameKey: z.string().min(1).optional(),
    label: z.string().nullable().optional(),
    minimumLevel: CharacterLevelSchema.optional(),
    basicAdd: BastionBuildCostSchema.optional(),
    basicUpgrade: BastionBasicUpgradeSchema.optional(),
  })
  .strict();

const BastionOrderSchema = z
  .object({
    ruleset: RulesetSchema,
    kind: z.literal("order"),
    id: z.string().min(1),
    name: z.string().min(1),
    sort: z.number().int(),
    nameKey: z.string().min(1).optional(),
    label: z.string().nullable().optional(),
    minimumLevel: CharacterLevelSchema.optional(),
  })
  .strict();

const BastionFacilitySchema = z
  .object({
    ruleset: RulesetSchema,
    kind: z.literal("facility"),
    id: z.string().min(1),
    name: z.string().min(1),
    facilityType: z.string().min(1),
    orders: z.array(z.string()),
    description: z.string(),
    nameKey: z.string().min(1).optional(),
    label: z.string().nullable().optional(),
    sort: z.number().int().optional(),
    minimumLevel: z.number().int().min(0).max(20).optional(),
    prerequisite: z.string().nullable().optional(),
    hirelings: nonnegInt.nullable().optional(),
    allowMultiple: z.boolean().optional(),
    space: z.string().nullable().optional(),
    /** Sizes a basic facility may have. */
    spaces: z.array(z.string().min(1)).optional(),
    upgrade: BastionFacilityUpgradeSchema.optional(),
  })
  .strict();

export const BastionSchema = z.discriminatedUnion("kind", [
  BastionRulesSchema,
  BastionSpaceSchema,
  BastionOrderSchema,
  BastionFacilitySchema,
]);
