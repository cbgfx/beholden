import { z } from "zod";
import { nonnegInt, SIZE, checkUniqueIds, RulesetSchema } from "./grandCompendiumSchemas.shared.js";

const NamedBonusSchema = z
  .object({
    name: z.string().min(1),
    bonus: z.number().optional(),
  })
  .strict();

const AttackSchema = z
  .object({
    toHit: z.number(),
    reach: z.string().min(1).optional(),
    range: z.string().min(1).optional(),
    melee: z.literal(true).optional(),
    ranged: z.literal(true).optional(),
  })
  .strict();

const DamageComponentSchema = z.object({
  roll: z.string().min(1),
  type: z.union([z.string().min(1), z.array(z.string().min(1)).min(2)]),
}).strict();

const DamageSchema = z.union([
  DamageComponentSchema,
  z.array(DamageComponentSchema).min(2),
]);

const RoutineStepSchema = z.object({
  use: z.string().min(1).optional(),
  choose: z.array(z.string().min(1)).min(2).optional(),
  count: z.number().int().min(2).optional(),
  optional: z.literal(true).optional(),
}).strict().refine((step) => Number(step.use !== undefined) + Number(step.choose !== undefined) === 1, {
  message: "Routine step requires exactly one of use or choose",
});

const ReplacementSchema = z.object({
  count: z.number().int().min(2).optional(),
  with: z.array(z.string().min(1)).min(1),
}).strict();

const RechargeSchema = z.union([
  z.object({ roll: z.number().int().min(1).max(6) }).strict(),
  z.object({ uses: z.number().int().min(1), period: z.enum(["day", "turn"]) }).strict(),
  z.object({ period: z.enum(["short_rest", "long_rest"]) }).strict(),
]);

const ActionEntrySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    recharge: RechargeSchema.optional(),
    spellSlots: z.record(z.string(), nonnegInt).optional(),
    attack: AttackSchema.optional(),
    damage: DamageSchema.optional(),
    routine: z.array(RoutineStepSchema).min(1).optional(),
    replace: ReplacementSchema.optional(),
    area: z.enum(["cone", "line", "sphere", "cube", "emanation"]).optional(),
    targets: z.number().int().min(2).optional(),
  })
  .strict()
  .refine((action) => action.area === undefined || action.targets === undefined, {
    message: "Use area or targets, not both",
  });

export const MonsterSchema = z
  .object({
    id: z.string().min(1),
    ruleset: RulesetSchema,
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    classification: z
      .object({
        size: SIZE.optional(),
        type: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        sortName: z.string().min(1).optional(),
        alignment: z.string().min(1).optional(),
        ancestry: z.string().min(1).optional(),
        environment: z.array(z.string().min(1)).min(1).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    description: z.string().min(1).optional(),
    initiativeBonus: z.number().int().optional(),
    passivePerception: nonnegInt.optional(),
    npc: z.literal(true).optional(),
    challenge: z
      .object({
        rating: z.string().min(1).optional(),
        xp: z.number().min(0).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    armorClass: z
      .object({
        value: z.number().int().positive(),
        source: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    // Average HP is deterministic arithmetic from the formula (floor rule) and is stored only
    // when there is no formula to derive it from.
    hitPoints: z
      .object({
        average: z.number().int().positive().optional(),
        formula: z.string().min(1).optional(),
      })
      .strict()
      .refine((value) => value.average !== undefined || value.formula !== undefined, "hitPoints requires average or formula")
      .optional(),
    movement: z
      .object({
        walk: nonnegInt.optional(),
        burrow: nonnegInt.optional(),
        climb: nonnegInt.optional(),
        fly: nonnegInt.optional(),
        swim: nonnegInt.optional(),
        hover: z.literal(true).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    abilities: z
      .object({
        str: z.number().int().min(1).max(30).optional(),
        dex: z.number().int().min(1).max(30).optional(),
        con: z.number().int().min(1).max(30).optional(),
        int: z.number().int().min(1).max(30).optional(),
        wis: z.number().int().min(1).max(30).optional(),
        cha: z.number().int().min(1).max(30).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    proficiencies: z
      .object({
        savingThrows: z.array(NamedBonusSchema).min(1).optional(),
        skills: z.array(NamedBonusSchema).min(1).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    defenses: z
      .object({
        vulnerabilities: z.array(z.string().min(1)).min(1).optional(),
        resistances: z.array(z.string().min(1)).min(1).optional(),
        damageImmunities: z.array(z.string().min(1)).min(1).optional(),
        conditionImmunities: z.array(z.string().min(1)).min(1).optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    senses: z.array(z.string().min(1)).min(1).optional(),
    languages: z.array(z.string().min(1)).min(1).optional(),
    treasure: z.string().min(1).optional(),
    traits: z.array(ActionEntrySchema).min(1).optional(),
    actions: z.array(ActionEntrySchema).min(1).optional(),
    reactions: z.array(ActionEntrySchema).min(1).optional(),
    legendaryActions: z.array(ActionEntrySchema).min(1).optional(),
    legendaryUses: z.number().int().min(1).optional(),
    lair: z.array(z.object({ name: z.string().min(1), description: z.string().min(1) }).strict()).min(1).optional(),
    spellcasting: z.array(ActionEntrySchema).min(1).optional(),
    // Spell references are IDs; display names come from the spell catalog at read time
    // (one fact, one home). `level` is the rare typed cast-level override (e.g. a monster
    // casting Fireball as a level 4 spell).
    spells: z.array(
      z.object({
        id: z.string().min(1),
        level: z.number().int().min(1).max(9).optional(),
      }).strict(),
    ).min(1).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    checkUniqueIds(data.traits ?? [], ctx, "traits");
    checkUniqueIds(data.actions ?? [], ctx, "actions");
    checkUniqueIds(data.reactions ?? [], ctx, "reactions");
    checkUniqueIds(data.legendaryActions ?? [], ctx, "legendaryActions");
    checkUniqueIds(data.spellcasting ?? [], ctx, "spellcasting");
    if ((data.legendaryUses === undefined) !== (data.legendaryActions === undefined)) {
      ctx.addIssue({ code: "custom", path: ["legendaryUses"], message: "legendaryUses and legendaryActions must be provided together" });
    }
    const actionIds = new Set((data.actions ?? []).map((action) => action.id));
    for (const [actionIndex, action] of (data.actions ?? []).entries()) {
      for (const [stepIndex, step] of (action.routine ?? []).entries()) {
        for (const id of step.use ? [step.use] : step.choose ?? []) {
          if (!actionIds.has(id) || id === action.id) {
            ctx.addIssue({ code: "custom", path: ["actions", actionIndex, "routine", stepIndex], message: `Unknown or recursive action reference: ${id}` });
          }
        }
      }
      for (const id of action.replace?.with ?? []) {
        if (!actionIds.has(id) || id === action.id) {
          ctx.addIssue({ code: "custom", path: ["actions", actionIndex, "replace", "with"], message: `Unknown or recursive action reference: ${id}` });
        }
      }
    }
  });
