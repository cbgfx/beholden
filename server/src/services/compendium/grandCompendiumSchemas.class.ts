import { z } from "zod";
import {
  nonnegInt,
  RECOVERY,
  ABILITY,
  StructuredFeatureEffectSchema,
  CompactScalingRollSchema,
  PreparedSpellProgressionSchema,
  RulesetSchema,
  checkUniqueIds,
} from "./grandCompendiumSchemas.shared.js";
import { EquipmentSchema } from "./grandCompendiumSchemas.background.js";

const AbilityRequirementSchema = z.union([
  ABILITY,
  z.object({ any: z.array(ABILITY).min(2) }).strict(),
  z.object({ all: z.array(ABILITY).min(2) }).strict(),
]);

const MulticlassSpellcastingSchema = z.discriminatedUnion("progression", [
  z.object({ progression: z.literal("full") }).strict(),
  z.object({ progression: z.literal("half"), rounding: z.enum(["down", "up"]).optional() }).strict(),
  z.object({ progression: z.literal("third") }).strict(),
  z.object({ progression: z.literal("pact") }).strict(),
]);

const ClassFeatureChoiceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("feat"),
    category: z.literal("F"),
    count: z.number().int().positive().optional(),
    replace: z.literal(true).optional(),
  }).strict(),
  z.object({
    kind: z.literal("weapon_mastery"),
    known: z.record(z.string().regex(/^(?:[1-9]|1[0-9]|20)$/u), z.number().int().positive()),
    melee: z.literal(true).optional(),
  }).strict(),
  z.object({
    kind: z.literal("expertise"),
    known: z.record(z.string().regex(/^(?:[1-9]|1[0-9]|20)$/u), z.number().int().positive()),
    from: z.array(z.string().min(1)).min(1).optional(),
  }).strict(),
  z.object({
    kind: z.literal("proficiency"),
    category: z.enum(["skill", "tool", "language", "saving_throw"]),
    count: z.number().int().positive(),
    from: z.union([
      z.enum(["class_skills", "artisan_tools"]),
      z.array(z.string().min(1)).min(1),
    ]).optional(),
    /** Offer this replacement only when the named proficiency already exists. */
    ifProficient: z.string().min(1).optional(),
  }).strict(),
  z.object({
    id: z.string().regex(/^fc_[a-z0-9_]+$/u),
    kind: z.literal("spell"),
    lists: z.array(z.string().regex(/^sl_[a-z0-9_]+$/u)).min(1),
    count: z.number().int().positive().optional(),
    level: z.number().int().min(0).max(9).optional(),
    maxLevel: z.number().int().min(0).max(9).optional(),
    school: z.string().min(1).optional(),
    mode: z.enum(["known", "prepared", "spellbook"]),
    replace: z.literal(true).optional(),
    perNewSlotLevel: z.literal(true).optional(),
    freeCast: z.literal(true).optional(),
    /** Offer this fallback choice only when the named fixed grant is already known. */
    ifKnown: z.string().min(1).optional(),
  }).strict().refine((choice) => choice.level == null || choice.maxLevel == null, "Use level or maxLevel, not both"),
]);

const ClassFeatureSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    description: z.string(),
    source: z.string().min(1).optional(),
    subclass: z.string().regex(/^sc_[a-z0-9_]+$/u).optional(),
    talent: z.object({
      kind: z.enum(["invocation", "maneuver", "metamagic"]),
      known: z.record(z.string().regex(/^(?:[1-9]|1[0-9]|20)$/u), z.number().int().positive()),
      replace: z.literal(true).optional(),
      ability: z.array(ABILITY).min(2).optional(),
    }).strict().optional(),
    choices: z.array(ClassFeatureChoiceSchema).min(1).optional(),
    noteTemplate: z.object({
      id: z.string().regex(/^nt_[a-z0-9_]+$/u),
      title: z.string().min(1),
      text: z.string().min(1),
    }).strict().optional(),
    effects: z.array(StructuredFeatureEffectSchema).min(1).optional(),
    scalingRolls: z.array(CompactScalingRollSchema).min(1).optional(),
    preparedSpellProgression: z.array(PreparedSpellProgressionSchema).min(1).optional(),
    resolution: z.enum(["automatic", "manual", "mixed"]).optional(),
    resolutionNotes: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();

const ClassChoiceSchema = z
  .object({
    id: z.string().regex(/^cc_[a-z0-9_]+$/u),
    name: z.string().min(1),
    options: z.array(z.object({
      id: z.string().regex(/^cco_[a-z0-9_]+$/u),
      name: z.string().min(1),
      features: z.array(z.string().min(1)).min(1),
    }).strict()).min(2),
  })
  .strict();

const ClassResourceSchema = z
  .object({
    name: z.string().min(1),
    uses: nonnegInt,
    recovery: RECOVERY.optional(),
    subclass: z.string().regex(/^sc_[a-z0-9_]+$/u).optional(),
  })
  .strict();

const ClassLevelSchema = z
  .object({
    level: z.number().int().min(1).max(20),
    abilityScoreImprovement: z.literal(true).optional(),
    cantripsKnown: nonnegInt.optional(),
    spellsPrepared: nonnegInt.optional(),
    spellSlots: z.record(z.string(), nonnegInt)
      .refine((v) => Object.keys(v).length > 0, "Empty spellSlots must be omitted")
      .optional(),
    features: z.array(ClassFeatureSchema).min(1).optional(),
    resources: z.array(ClassResourceSchema).min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    checkUniqueIds(data.features ?? [], ctx, "features");
  });

const ClassToolChoiceSchema = z
  .object({
    count: z.number().int().min(1),
    from: z.array(z.string()),
  })
  .strict();

export const ClassToolProficiencySchema = z
  .object({
    fixed: z.array(z.string()).min(1).optional(),
    choices: z.array(ClassToolChoiceSchema).min(1).optional(),
    notes: z.array(z.string()).min(1).optional(),
  })
  .strict();

export type ClassToolProficiency = z.infer<typeof ClassToolProficiencySchema>;

const SubclassSpellcastingProgressionRowSchema = z.object({
  level: z.number().int().min(1).max(20),
  cantrips: nonnegInt.optional(),
  prepared: nonnegInt.optional(),
  /** Spell-slot counts by spell level; trailing zeroes are omitted. */
  slots: z.array(nonnegInt).min(1).max(9).optional(),
}).strict().refine(
  (row) => row.cantrips != null || row.prepared != null || row.slots != null,
  "Empty subclass spellcasting progression rows must be omitted",
);

export const ClassSchema = z
  .object({
    id: z.string().min(1),
    ruleset: RulesetSchema,
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    description: z.string(),
    descriptions: z.array(z.string().min(1)).min(1).optional(),
    hitDie: z.number().int().positive().optional(),
    startingWealth: z.number().min(0).optional(),
    primaryAbility: AbilityRequirementSchema.optional(),
    equipment: EquipmentSchema.optional(),
    multiclass: z.object({
      requirements: z.object({
        ability: AbilityRequirementSchema,
        /** 13 is the standard threshold. */
        minimum: z.number().int().min(1).max(30).optional(),
      }).strict(),
      skills: z.object({ choose: z.number().int().positive(), from: z.array(z.string()).optional() }).strict().optional(),
      armor: z.array(z.string()).min(1).optional(),
      weapons: z.array(z.string()).min(1).optional(),
      tools: ClassToolProficiencySchema.optional(),
      spellcasting: MulticlassSpellcastingSchema.optional(),
      exceptions: z.array(z.string().min(1)).min(1).optional(),
    }).strict().optional(),
    subclasses: z.object({
      level: z.number().int().min(1).max(20),
      options: z.record(z.string().regex(/^sc_[a-z0-9_]+$/u), z.union([
        z.string().min(1),
        z.object({
          name: z.string().min(1),
          spellcasting: z.object({
            ability: ABILITY,
            list: z.string().regex(/^sl_[a-z0-9_]+$/u),
            contribution: z.literal("third").optional(),
            progression: z.array(SubclassSpellcastingProgressionRowSchema).min(1).superRefine((rows, ctx) => {
              const seen = new Set<number>();
              rows.forEach((row, index) => {
                if (seen.has(row.level)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate progression level ${row.level}`, path: [index, "level"] });
                seen.add(row.level);
              });
            }).optional(),
          }).strict().optional(),
        }).strict(),
      ]))
        .refine((v) => Object.keys(v).length > 0, "Subclass options must not be empty"),
    }).strict().optional(),
    choices: z.array(ClassChoiceSchema).min(1).optional(),
    spellLists: z.record(z.string().regex(/^sl_[a-z0-9_]+$/u), z.string().min(1)).optional(),
    proficiencies: z
      .object({
        savingThrows: z.array(ABILITY),
        skills: z
          .object({
            choose: nonnegInt,
            from: z.array(z.string()),
          })
          .strict(),
        armor: z.array(z.string()),
        weapons: z.array(z.string()),
        tools: ClassToolProficiencySchema
          .refine((v) => (v.fixed?.length ?? 0) + (v.choices?.length ?? 0) + (v.notes?.length ?? 0) > 0, "Empty tools must be omitted")
          .optional(),
      })
      .strict(),
    spellcasting: z
      .object({
        ability: ABILITY.optional(),
        list: z.string().regex(/^sl_[a-z0-9_]+$/u).optional(),
        slotRecovery: RECOVERY.optional(),
        preparedSpellChanges: RECOVERY.optional(),
        preparedFormula: z.object({
          classLevelDivisor: z.union([z.literal(1), z.literal(2)]).optional(),
          rounding: z.enum(["down", "up"]).optional(),
          minimum: z.number().int().positive().optional(),
        }).strict().optional(),
      })
      .strict().optional(),
    levels: z.array(ClassLevelSchema),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seen = new Set<number>();
    for (let i = 0; i < data.levels.length; i++) {
      const n = data.levels[i]!.level;
      if (seen.has(n)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate level number ${n}`,
          path: ["levels", i, "level"],
        });
      }
      seen.add(n);
    }
    const subclassIds = new Set(Object.keys(data.subclasses?.options ?? {}));
    const featureIds = new Set<string>();
    const noteTemplateIds = new Set<string>();
    for (const [levelIndex, level] of data.levels.entries()) {
      for (const [featureIndex, feature] of (level.features ?? []).entries()) {
        if (feature.id) {
          if (featureIds.has(feature.id)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate class feature id ${feature.id}`, path: ["levels", levelIndex, "features", featureIndex, "id"] });
          }
          featureIds.add(feature.id);
        }
        if (feature.subclass && !subclassIds.has(feature.subclass)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown subclass ${feature.subclass}`, path: ["levels", levelIndex, "features", featureIndex, "subclass"] });
        }
        if (feature.noteTemplate) {
          if (noteTemplateIds.has(feature.noteTemplate.id)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate note template id ${feature.noteTemplate.id}`, path: ["levels", levelIndex, "features", featureIndex, "noteTemplate", "id"] });
          }
          noteTemplateIds.add(feature.noteTemplate.id);
        }
      }
      for (const [resourceIndex, resource] of (level.resources ?? []).entries()) {
        if (resource.subclass && !subclassIds.has(resource.subclass)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown subclass ${resource.subclass}`, path: ["levels", levelIndex, "resources", resourceIndex, "subclass"] });
        }
      }
    }
    const choiceIds = new Set<string>();
    for (const [choiceIndex, choice] of (data.choices ?? []).entries()) {
      if (choiceIds.has(choice.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate class choice id ${choice.id}`, path: ["choices", choiceIndex, "id"] });
      choiceIds.add(choice.id);
      const optionIds = new Set<string>();
      for (const [optionIndex, option] of choice.options.entries()) {
        if (optionIds.has(option.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate option id ${option.id}`, path: ["choices", choiceIndex, "options", optionIndex, "id"] });
        optionIds.add(option.id);
        for (const [featureIndex, featureId] of option.features.entries()) {
          if (!featureIds.has(featureId)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Unknown class feature ${featureId}`, path: ["choices", choiceIndex, "options", optionIndex, "features", featureIndex] });
        }
      }
    }
  });
