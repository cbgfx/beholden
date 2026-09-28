import { z } from "zod";

export const CHARACTER_EXPORT_FORMAT = "beholden.character" as const;
export const CHARACTER_EXPORT_VERSION = 2 as const;

const AbilityKeySchema = z.enum(["str", "dex", "con", "int", "wis", "cha"]);
const AbilityScoreSchema = z.number().int().min(1).max(30).nullable();

export const CharacterExportConditionSchema = z.object({
  key: z.string().trim().min(1).max(64),
  casterId: z.string().trim().min(1).max(160).nullable().optional(),
  hexAbility: AbilityKeySchema.optional(),
  concentrationId: z.string().trim().min(1).max(160).nullable().optional(),
  expiresAtRound: z.number().int().min(1).max(100_000).nullable().optional(),
}).passthrough();

export const CharacterExportOverridesSchema = z.object({
  tempHp: z.number().int(),
  acBonus: z.number().int(),
  hpMaxBonus: z.number().int(),
  inspiration: z.boolean().optional(),
  abilityScores: z.object({
    str: z.number().int().min(-30).max(30).optional(),
    dex: z.number().int().min(-30).max(30).optional(),
    con: z.number().int().min(-30).max(30).optional(),
    int: z.number().int().min(-30).max(30).optional(),
    wis: z.number().int().min(-30).max(30).optional(),
    cha: z.number().int().min(-30).max(30).optional(),
  }).strict().optional(),
  permanent: z.object({
    acBonus: z.boolean().optional(),
    hpMaxBonus: z.boolean().optional(),
    abilityScores: z.boolean().optional(),
  }).strict().optional(),
}).strict();

/** Portable character state. Account, campaign, revision, timestamp, and image fields are excluded. */
export const CharacterExportV2CharacterSchema = z.object({
  name: z.string().trim().min(1),
  playerName: z.string().optional(),
  ruleset: z.enum(["5e", "5.5e"]),
  className: z.string(),
  species: z.string(),
  level: z.number().int().min(1).max(20),
  hpMax: z.number().int().nonnegative(),
  hpCurrent: z.number().int().nonnegative(),
  ac: z.number().int(),
  speed: z.number().int().nonnegative(),
  strScore: AbilityScoreSchema,
  dexScore: AbilityScoreSchema,
  conScore: AbilityScoreSchema,
  intScore: AbilityScoreSchema,
  wisScore: AbilityScoreSchema,
  chaScore: AbilityScoreSchema,
  color: z.string().nullable(),
  derivedHpMax: z.number().int().positive().nullable().optional(),
  derivedSpeed: z.number().int().nonnegative().nullable().optional(),
  characterData: z.record(z.string(), z.unknown()).nullable(),
  isActive: z.boolean().default(true),
  conditions: z.array(CharacterExportConditionSchema).max(100).optional(),
  overrides: CharacterExportOverridesSchema.optional(),
  deathSaves: z.object({
    success: z.number().int().min(0).max(3),
    fail: z.number().int().min(0).max(3),
  }).strict().optional(),
  sharedNotes: z.string().max(200_000).optional(),
});

export const CharacterExportV2Schema = z.object({
  format: z.literal(CHARACTER_EXPORT_FORMAT),
  version: z.literal(CHARACTER_EXPORT_VERSION),
  exportedAt: z.iso.datetime(),
  character: CharacterExportV2CharacterSchema,
}).strict();

export type CharacterExportV2 = z.infer<typeof CharacterExportV2Schema>;

export function buildCharacterExportV2(character: unknown, exportedAt = new Date().toISOString()): CharacterExportV2 {
  return CharacterExportV2Schema.parse({
    format: CHARACTER_EXPORT_FORMAT,
    version: CHARACTER_EXPORT_VERSION,
    exportedAt,
    character,
  });
}
