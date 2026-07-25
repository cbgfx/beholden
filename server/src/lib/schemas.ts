// server/src/lib/schemas.ts
// Shared Zod schemas reused across multiple route files.
import { z } from "zod";

/** A condition applied to a combatant or player. */
export const ConditionInstanceSchema = z.object({
  key: z.string(),
  casterId: z.string().nullable().optional(),
  hexAbility: z.enum(["str", "dex", "con", "int", "wis", "cha"]).optional(),
  /** Identifies a specific concentration session, so a dependent condition (e.g. Hexed, Marked)
   * can be tied to the exact casting it came from rather than just its caster — see
   * combatTransitions.ts's ensureConcentrationId/detectEndedConcentration/removeConditionsOwnedBy. */
  concentrationId: z.string().nullable().optional(),
}).passthrough();

/** Per-attack stat overrides keyed by attack name. */
export const AttackOverrideSchema = z.record(
  z.string(),
  z.object({
    toHit: z.number().optional(),
    damage: z.string().optional(),
    damageType: z.string().optional(),
  }).passthrough()
).nullable();

/** Temporary HP / AC bonus / HP max bonus for a combatant or player. */
const AbilityScoreOverridesSchema = z.object({
  str: z.number().int().min(1).max(30).optional(),
  dex: z.number().int().min(1).max(30).optional(),
  con: z.number().int().min(1).max(30).optional(),
  int: z.number().int().min(1).max(30).optional(),
  wis: z.number().int().min(1).max(30).optional(),
  cha: z.number().int().min(1).max(30).optional(),
});

export const OverridesSchema = z.object({
  tempHp: z.number().default(0),
  acBonus: z.number().default(0),
  hpMaxBonus: z.number().default(0),
  inspiration: z.boolean().default(false),
  abilityScores: AbilityScoreOverridesSchema.optional(),
});
