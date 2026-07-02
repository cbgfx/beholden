import { z } from "zod";
import { CANONICAL_V2_SCHEMA_VERSION, nonnegInt } from "./nativeCompendiumV2Schemas.shared.js";

export const DeckSchema = z
  .object({
    schemaVersion: z.literal(CANONICAL_V2_SCHEMA_VERSION),
    id: z.string().min(1),
    deckName: z.string().min(1),
    deckKey: z.string().min(1),
    cardName: z.string().min(1),
    cardKey: z.string().min(1),
    text: z.string(),
    sort: z.number().int(),
  })
  .strict();

const BastionSpaceSchema = z
  .object({
    schemaVersion: z.literal(CANONICAL_V2_SCHEMA_VERSION),
    kind: z.literal("space"),
    id: z.string().min(1),
    name: z.string().min(1),
    squares: z.number().int().min(1),
    sort: z.number().int(),
    nameKey: z.string().min(1).optional(),
    label: z.string().nullable().optional(),
    minimumLevel: z.number().int().min(1).max(20).optional(),
  })
  .strict();

const BastionOrderSchema = z
  .object({
    schemaVersion: z.literal(CANONICAL_V2_SCHEMA_VERSION),
    kind: z.literal("order"),
    id: z.string().min(1),
    name: z.string().min(1),
    sort: z.number().int(),
    nameKey: z.string().min(1).optional(),
    label: z.string().nullable().optional(),
    minimumLevel: z.number().int().min(1).max(20).optional(),
  })
  .strict();

const BastionFacilitySchema = z
  .object({
    schemaVersion: z.literal(CANONICAL_V2_SCHEMA_VERSION),
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
  })
  .strict();

export const BastionSchema = z.discriminatedUnion("kind", [
  BastionSpaceSchema,
  BastionOrderSchema,
  BastionFacilitySchema,
]);
