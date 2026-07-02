import { z } from "zod";
import {
  nonnegInt,
  RECOVERY,
  ABILITY,
  StructuredFeatureEffectSchema,
  CompactScalingRollSchema,
  PreparedSpellProgressionSchema,
  checkUniqueIds,
} from "./nativeCompendiumV2Schemas.shared.js";

const ClassFeatureSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(1),
    description: z.string(),
    source: z.string().min(1).optional(),
    subclass: z.string().min(1).optional(),
    optional: z.literal(true).optional(),
    effects: z.array(StructuredFeatureEffectSchema).min(1).optional(),
    scalingRolls: z.array(CompactScalingRollSchema).min(1).optional(),
    preparedSpellProgression: z.array(PreparedSpellProgressionSchema).min(1).optional(),
    resolution: z.enum(["automatic", "manual", "mixed"]).optional(),
    resolutionNotes: z.array(z.string().min(1)).min(1).optional(),
  })
  .strict();

const ClassResourceSchema = z
  .object({
    name: z.string().min(1),
    uses: nonnegInt,
    recovery: RECOVERY.optional(),
    subclass: z.string().min(1).optional(),
  })
  .strict();

const ClassLevelSchema = z
  .object({
    level: z.number().int().min(1).max(20),
    abilityScoreImprovement: z.literal(true).optional(),
    cantripsKnown: nonnegInt.optional(),
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

export const ClassSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    description: z.string(),
    descriptions: z.array(z.string().min(1)).min(1).optional(),
    hitDie: z.number().int().positive().optional(),
    startingWealth: z.number().min(0).optional(),
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
        slotRecovery: RECOVERY,
      })
      .strict(),
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
  });
