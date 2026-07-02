import { z, ZodIssueCode } from "zod";
import type { RefinementCtx } from "zod";

export type NativeCompendiumCategory =
  | "monsters"
  | "items"
  | "spells"
  | "classes"
  | "species"
  | "backgrounds"
  | "feats"
  | "decks"
  | "bastions";

export const CANONICAL_V2_SCHEMA_VERSION = 2 as const;

// ── Primitives ────────────────────────────────────────────────────────────────

export const nonnegInt = z.number().int().min(0);
export const abilityScore = z.number().int().min(1).max(30).nullable();
export const RECOVERY = z.enum(["short_rest", "long_rest"]);
export const SIZE = z.enum(["T", "S", "M", "L", "H", "G"]);
export const ABILITY = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

// ── Helper ────────────────────────────────────────────────────────────────────

export function checkUniqueIds(
  items: ReadonlyArray<{ id?: string | undefined }>,
  ctx: RefinementCtx,
  field: string,
): void {
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const id = items[i]!.id;
    if (id === undefined) continue;
    if (seen.has(id)) {
      ctx.addIssue({
        code: ZodIssueCode.custom,
        message: `Duplicate id "${id}"`,
        path: [field, i, "id"],
      });
    }
    seen.add(id);
  }
}

// ── Shared sub-schemas ────────────────────────────────────────────────────────

export const PreparedSpellProgressionSchema = z
  .object({
    label: z.string().nullable(),
    levelLabel: z.string(),
    spellLabel: z.string(),
    rows: z.array(z.object({
      level: z.number().int().min(1).max(20),
      spells: z.array(z.string()),
    }).strict()),
    choiceGroupKey: z.string().nullable().optional(),
    choicePrompt: z.string().nullable().optional(),
    choiceOptionLabel: z.string().nullable().optional(),
    choiceOptions: z.array(z.string()).nullable().optional(),
  })
  .strict();

export const StructuredFeatureEffectSchema = z.union([
  z.object({
    kind: z.literal("source_modifier"),
    category: z.string().nullable(),
    value: z.string(),
  }).strict(),
  z.object({
    kind: z.literal("source_special"),
    value: z.string(),
  }).strict(),
  z.object({
    kind: z.literal("source_proficiency"),
    value: z.string(),
  }).strict(),
  z.object({
    type: z.enum([
      "ability_score",
      "resource_grant",
      "spell_grant",
      "spell_choice",
      "proficiency_grant",
      "weapon_mastery",
      "armor_class",
      "speed",
      "defense",
      "modifier",
      "hit_points",
      "attack",
      "check_override",
      "action",
      "senses",
      "choice_bundle",
      "narrative",
    ]),
  }).passthrough(),
]);

export const FeatChoiceSchema = z
  .object({
    id: z.string(),
    type: z.enum([
      "proficiency", "expertise", "ability_score", "spell", "spell_list",
      "weapon_mastery", "damage_type",
    ]),
    count: nonnegInt,
    countFrom: z.literal("proficiency_bonus").optional(),
    options: z.array(z.string()).min(1).optional(),
    anyOf: z.array(z.string()).optional(),
    amount: z.number().optional(),
    level: z.number().int().optional(),
    linkedTo: z.string().min(1).optional(),
    dependsOnChoiceId: z.string().min(1).optional(),
    dependencyKind: z.enum(["spell_list", "ability_score", "replacement"]).optional(),
    replacementFor: z.string().min(1).optional(),
    distinct: z.literal(true).optional(),
    note: z.string().min(1).optional(),
  })
  .strict();

export const FeatMechanicsSchema = z
  .object({
    resolution: z.enum(["automatic", "manual", "mixed"]).optional(),
    resolutionNotes: z.array(z.string().min(1)).min(1).optional(),
    category: z.string().min(1).optional(),
    baseName: z.string().min(1).optional(),
    variant: z.string().min(1).optional(),
    prerequisite: z.string().min(1).optional(),
    repeatable: z.literal(true).optional(),
    source: z.string().min(1).optional(),
    grants: z.object({
      skills: z.array(z.string()).optional(),
      tools: z.array(z.string()).optional(),
      languages: z.array(z.string()).optional(),
      armor: z.array(z.string()).optional(),
      weapons: z.array(z.string()).optional(),
      savingThrows: z.array(z.string()).optional(),
      spells: z.array(z.string()).optional(),
      cantrips: z.array(z.string()).optional(),
      abilityIncreases: z.record(z.string(), z.number()).optional(),
      bonuses: z.array(z.object({ target: z.string(), value: z.number() }).strict()).optional(),
      effects: z.array(StructuredFeatureEffectSchema).optional(),
    }).strict().optional(),
    choices: z.array(FeatChoiceSchema).optional(),
    uses: z.array(z.object({
      count: nonnegInt,
      countFrom: z.enum(["proficiency_bonus", "ability_modifier"]).optional(),
      ability: z.string().min(1).optional(),
      minimum: z.number().optional(),
      recharge: z.enum(["short_rest", "long_rest", "short_or_long_rest"]).optional(),
      note: z.string(),
    }).strict()).optional(),
    preparedSpellProgression: z.array(PreparedSpellProgressionSchema).optional(),
    notes: z.array(z.string()).optional(),
    modifierDetails: z.array(z.object({
      category: z.string(),
      text: z.string(),
      target: z.string().min(1).optional(),
      value: z.number().optional(),
    }).strict()).optional(),
    spellcastingAbility: ABILITY.optional(),
    spellcastingAbilityFromChoiceId: z.string().min(1).optional(),
  })
  .strict();

export const ProficiencyChoiceSchema = z
  .object({
    fixed: z.array(z.string()),
    choose: nonnegInt,
    from: z.array(z.string()).nullable(),
  })
  .strict();

export const SpeciesChoiceSchema = z
  .object({
    hasChosenSize: z.literal(true).optional(),
    skillChoice: z.object({ count: nonnegInt, from: z.array(z.string()).nullable() }).strict().optional(),
    toolChoice: z.object({ count: nonnegInt, from: z.array(z.string()).nullable() }).strict().optional(),
    languageChoice: z.object({ count: nonnegInt, from: z.array(z.string()).nullable() }).strict().optional(),
    hasFeatChoice: z.literal(true).optional(),
  })
  .strict();

export const BackgroundProficienciesSchema = z
  .object({
    skills: ProficiencyChoiceSchema,
    tools: ProficiencyChoiceSchema,
    languages: ProficiencyChoiceSchema,
    feats: z.array(z.object({
      name: z.string(),
      parsed: FeatMechanicsSchema,
    }).strict()),
    featChoice: nonnegInt,
    abilityScores: z.array(z.string()),
    abilityScoreChoose: nonnegInt,
  })
  .strict();

export const ScalingRollSchema = z
  .object({
    description: z.string().nullable(),
    level: z.number().int().min(1).max(20).nullable(),
    formula: z.string().min(1),
  })
  .strict();

export const CompactScalingRollSchema = z
  .object({
    description: z.string().min(1).optional(),
    level: z.number().int().min(1).max(20).optional(),
    formula: z.string().min(1),
  })
  .strict();

export const TraitSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    category: z.string().min(1).optional(),
    scalingRolls: z.array(CompactScalingRollSchema).min(1).optional(),
    preparedSpellProgression: z.array(PreparedSpellProgressionSchema).min(1).optional(),
    resolution: z.enum(["automatic", "manual", "mixed"]).optional(),
    resolutionNotes: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();
