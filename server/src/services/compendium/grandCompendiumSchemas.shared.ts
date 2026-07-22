import { z, ZodIssueCode } from "zod";
import type { RefinementCtx } from "zod";

export type NativeCompendiumCategory =
  | "monsters"
  | "items"
  | "spells"
  | "classTalents"
  | "classes"
  | "species"
  | "backgrounds"
  | "feats"
  | "decks"
  | "bastions";

export const GRAND_COMPENDIUM_SCHEMA_VERSION = 2 as const;
export const RULESETS = ["5e", "5.5e"] as const;
export const RulesetSchema = z.enum(RULESETS);

// ── Primitives ────────────────────────────────────────────────────────────────

export const nonnegInt = z.number().int().min(0);
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
      "feat_choice",
      "rest_rule",
      "breathing",
    ]),
  }).passthrough(),
]);

const FeatChoiceSchema = z
  .object({
    id: z.string(),
    type: z.enum([
      "proficiency", "expertise", "ability_score", "spell", "spell_list",
      "weapon_mastery", "damage_type", "spellcasting_ability",
    ]),
    count: nonnegInt,
    countFrom: z.literal("proficiency_bonus").optional(),
    options: z.array(z.string()).min(1).optional(),
    anyOf: z.array(z.string()).optional(),
    amount: z.number().optional(),
    /** Ability-score choice only: the total may be split evenly across the selected abilities. */
    split: z.literal(true).optional(),
    /** 20 is the ability-increase default and is omitted. */
    maximum: z.number().int().min(1).max(30).optional(),
    level: z.number().int().optional(),
    /** Spell choice only: eligible spells may be of any level up to this cap ("at or below").
     * Mutually exclusive with `level`, which means exactly that level. */
    maxLevel: z.number().int().min(1).max(9).optional(),
    /** Spell choice only: eligible spells must have the Ritual tag. */
    ritual: z.literal(true).optional(),
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
      /** long_rest is the documented default and is omitted. */
      recharge: z.enum(["short_rest", "short_or_long_rest"]).optional(),
      note: z.string(),
      /** This use pool lets you free-cast a specific fixed spell already listed in
       * `grants.spells`/`grants.cantrips`. Mutually exclusive with `grantsChoiceId`. Runtime
       * surfaces it in Granted Spells with a charge badge instead of an unlabeled resource. */
      grantsSpell: z.string().min(1).optional(),
      /** This use pool lets you free-cast whichever spell the player picked for the named
       * `choices[].id` (a `type: "spell"` choice). Mutually exclusive with `grantsSpell`. */
      grantsChoiceId: z.string().min(1).optional(),
    }).strict().refine((value) => !(value.grantsSpell && value.grantsChoiceId), "grantsSpell and grantsChoiceId are mutually exclusive")).optional(),
    preparedSpellProgression: z.array(PreparedSpellProgressionSchema).optional(),
    rolls: z.array(z.object({
      description: z.string().min(1).optional(),
      formula: z.string().min(1),
    }).strict()).min(1).optional(),
    spellcastingAbility: ABILITY.optional(),
    spellcastingAbilityFromChoiceId: z.string().min(1).optional(),
  })
  .strict();

export const SpeciesChoiceSchema = z
  .object({
    hasChosenSize: z.literal(true).optional(),
    skillChoice: z.object({ count: nonnegInt, from: z.array(z.string()).nullable() }).strict().optional(),
    toolChoice: z.object({ count: nonnegInt, from: z.array(z.string()).nullable() }).strict().optional(),
    languageChoice: z.object({ count: nonnegInt, from: z.array(z.string()).nullable() }).strict().optional(),
    hasFeatChoice: z.literal(true).optional(),
    /** Present only when a species trait's spell(s) use a player-chosen governing ability (e.g. elf lineages, tiefling legacies: "Int, Wis, or Cha"). Omit for species with a single fixed `spellcastingAbility`. */
    spellcastingAbilityChoice: z.object({ options: z.array(ABILITY).min(2) }).strict().optional(),
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
    scalingRolls: z.array(CompactScalingRollSchema).min(1).optional(),
    preparedSpellProgression: z.array(PreparedSpellProgressionSchema).min(1).optional(),
    /** Verbatim FeatureEffect-shaped facts, consumed the same way feats' grants.effects are: no parsing. */
    effects: z.array(StructuredFeatureEffectSchema).min(1).optional(),
    resolution: z.enum(["automatic", "manual", "mixed"]).optional(),
    resolutionNotes: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();
