import { z } from "zod";
import {
  AttackOverrideSchema,
  ConditionInstanceSchema,
  OverridesSchema,
} from "../lib/schemas.js";

export const CombatStateBody = z.object({
  round: z.number().int().min(1).optional(),
  activeCombatantId: z.string().nullable().optional(),
});

export const AddPlayerBody = z.object({
  playerId: z.string(),
});

export const AddMonsterBody = z.object({
  monsterId: z.string(),
  qty: z.number().int().min(1).max(20).default(1),
  friendly: z.boolean().default(false),
  labelBase: z.string().optional(),
  ac: z.number().optional(),
  acDetails: z.string().nullable().optional(),
  hpMax: z.number().optional(),
  hpDetails: z.string().nullable().optional(),
  attackOverrides: AttackOverrideSchema.optional(),
});

export const AddInpcBody = z.object({
  inpcId: z.string(),
});

export const CombatantUpdateBody = z.object({
  label: z.string().optional(),
  initiative: z.number().nullable().optional(),
  friendly: z.boolean().optional(),
  color: z.string().optional(),
  // Authoritative damage/heal resolution: the server recomputes hpCurrent/overrides itself from
  // the freshly-read combatant (see hydratePlayerCombatant) rather than trusting a client-resolved
  // value, so a concurrent change (e.g. a player granting themselves temp HP mid-request) can't be
  // silently clobbered by a request that was computed against stale data. When present, this takes
  // priority over any hpCurrent/overrides/conditions also included in the same request (those are
  // still accepted for the optimistic client-side preview, but the server ignores them).
  hpDelta: z.object({
    kind: z.enum(["damage", "heal"]),
    amount: z.number().positive(),
  }).optional(),
  hpCurrent: z.number().optional(),
  hpMax: z.number().optional(),
  hpDetails: z.string().nullable().optional(),
  ac: z.number().optional(),
  acDetails: z.string().nullable().optional(),
  attackOverrides: AttackOverrideSchema.optional(),
  overrides: OverridesSchema.optional(),
  conditions: z.array(ConditionInstanceSchema).optional(),
  deathSaves: z.object({ success: z.number(), fail: z.number() }).optional(),
  usedReaction: z.boolean().optional(),
  usedLegendaryActions: z.number().int().min(0).optional(),
  usedLegendaryResistances: z.number().int().min(0).optional(),
  usedSpellSlots: z.record(z.string(), z.number()).optional(),
});
