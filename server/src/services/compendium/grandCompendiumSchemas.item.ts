import { z } from "zod";
import { nonnegInt, RulesetSchema, StructuredFeatureEffectSchema } from "./grandCompendiumSchemas.shared.js";

/** Every passive numeric bonus an item applies to a d20-facing statistic. Cold facts:
 * consumers sum `amount` by `target`; no label parsing. Ability-score changes are NOT
 * modifiers — they are `effects` (`ability_score`), and one-time consumables stay prose. */
export const ITEM_MODIFIER_TARGETS = [
  "ac",
  "melee_attacks",
  "melee_damage",
  "ranged_attacks",
  "ranged_damage",
  "weapon_attacks",
  "weapon_damage",
  "saving_throws",
  "ability_checks",
  "spell_attack",
  "spell_save_dc",
  "initiative",
  /** Ioun Stone (Mastery). No automated consumer yet — the fact is typed and ready. */
  "proficiency_bonus",
] as const;

const ModifierSchema = z
  .object({
    target: z.enum(ITEM_MODIFIER_TARGETS),
    amount: z.number().int().refine((value) => value !== 0, "A zero modifier must be omitted"),
  })
  .strict();

const ItemRollSchema = z
  .object({
    formula: z.string().min(1),
    description: z.string().min(1).optional(),
  })
  .strict();

export const WEAPON_MASTERY = z.enum(["Cleave", "Graze", "Nick", "Push", "Sap", "Slow", "Topple", "Vex"]);
export const AMMO_FAMILY = z.enum(["arrow", "bolt", "energy-cell", "firearm-bullet", "needle", "sling-bullet"]);

const UseAmountSchema = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d+d\d+(?:\+\d+)?$/u, "Expected a compact dice formula such as 1d6+1"),
]);

const D20ResultSchema = z.number().int().min(1).max(20);

const DepletionRollSchema = z
  .object({
    destroy: z.union([z.literal(true), D20ResultSchema]).optional(),
    mundane: z.union([z.literal(true), D20ResultSchema]).optional(),
    loseProperties: z.union([z.literal(true), D20ResultSchema]).optional(),
    regain: z.record(z.string().regex(/^(?:[1-9]|1\d|20)$/u), UseAmountSchema).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);

const ItemUsesSchema = z.union([
  UseAmountSchema,
  z
    .object({
      max: UseAmountSchema,
      recover: z.union([z.literal(false), UseAmountSchema]).optional(),
      depletion: z.union([z.enum(["destroy", "mundane", "loseProperties"]), DepletionRollSchema]).optional(),
    })
    .strict()
    .refine((value) => value.recover !== undefined || value.depletion !== undefined),
]);

const SpellCostSchema = z.union([nonnegInt, z.literal("level")]);
const ItemSpellAccessSchema = z.union([
  SpellCostSchema,
  z
    .object({
      cost: SpellCostSchema.optional(),
      level: z.number().int().min(0).max(9).optional(),
      uses: UseAmountSchema.optional(),
      consume: z.literal(true).optional(),
      maxLevel: z.number().int().min(0).max(9).optional(),
      maxCost: nonnegInt.optional(),
      upcast: z.number().int().positive().optional(),
      dc: nonnegInt.optional(),
      attack: z.number().int().optional(),
      note: z.string().min(1).optional(),
    })
    .strict()
    .refine((value) => Object.keys(value).length > 0),
]);

const ItemSpellcastingSchema = z.union([
  z.literal("character"),
  z
    .object({
      dc: nonnegInt.optional(),
      attack: z.number().int().optional(),
    })
    .strict()
    .refine((value) => value.dc !== undefined || value.attack !== undefined),
]);

const SpellLevelSchema = z.number().int().min(0).max(9);
const SpellStatsSchema = z.object({ dc: nonnegInt.optional(), attack: z.number().int().optional() }).strict()
  .refine((value) => value.dc !== undefined || value.attack !== undefined);
const ItemSpellTemplateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("bound"),
    level: SpellLevelSchema.optional(),
    minLevel: SpellLevelSchema.optional(),
    maxLevel: SpellLevelSchema.optional(),
    list: z.string().min(1).optional(),
    schools: z.array(z.string().min(1)).min(1).optional(),
    cost: SpellCostSchema.optional(),
    uses: z.number().int().positive().optional(),
    consume: z.literal(true).optional(),
    prepared: z.literal(true).optional(),
    dc: nonnegInt.optional(),
    attack: z.number().int().optional(),
    stats: z.record(z.string().regex(/^[0-9]$/u), SpellStatsSchema).optional(),
  }).strict(),
  z.object({
    kind: z.literal("stored"),
    capacity: z.number().int().positive(),
    minLevel: SpellLevelSchema.optional(),
    maxLevel: SpellLevelSchema.optional(),
    initial: z.string().min(1).optional(),
  }).strict(),
  z.object({
    kind: z.literal("choice"),
    list: z.string().min(1),
    level: SpellLevelSchema.optional(),
    minLevel: SpellLevelSchema.optional(),
    maxLevel: SpellLevelSchema.optional(),
    uses: z.number().int().positive().optional(),
    recovery: z.enum(["short_rest", "long_rest"]).optional(),
  }).strict(),
  z.object({
    kind: z.literal("random"),
    die: z.string().regex(/^1d(?:4|6|8|10|12|20|100)$/u),
    when: z.string().min(1).optional(),
    outcomes: z.record(
      z.string().regex(/^\d+(?:-\d+)?$/u),
      z.union([
        z.string().regex(/^s_/u),
        z.object({ id: z.string().regex(/^s_/u), level: SpellLevelSchema.optional(), note: z.string().min(1).optional() }).strict(),
      ]),
    ).refine((value) => Object.keys(value).length > 0),
  }).strict(),
]);

const ItemSpellTemplatesSchema = z.union([
  ItemSpellTemplateSchema,
  z.array(ItemSpellTemplateSchema).min(2),
]);

const ItemBundleSchema = z
  .object({
    container: z.string().regex(/^i_/u),
    items: z.record(z.string().regex(/^i_/u), z.number().int().positive())
      .refine((value) => Object.keys(value).length > 0),
  })
  .strict()
  .refine((value) => value.items[value.container] === undefined, "Container must not be repeated in bundle items");

export const ItemSchema = z
  .object({
    id: z.string().min(1),
    ruleset: RulesetSchema,
    name: z.string().min(1),
    source: z.string().min(1).optional(),
    type: z.string().min(1),
    rarity: z.string().min(1),
    magical: z.literal(true).optional(),
    attunement: z.union([z.literal(true), z.string().min(1)]).optional(),
    equippable: z.literal(true).optional(),
    weight: z.number().min(0).optional(),
    value: z.number().min(0).optional(),
    proficiency: z.string().min(1).optional(),
    ammo: AMMO_FAMILY.optional(),
    usage: z.literal("held").optional(),
    bundle: ItemBundleSchema.optional(),
    container: z.literal(true).optional(),
    ignoreWeight: z.literal(true).optional(),
    effects: z.array(StructuredFeatureEffectSchema).min(1).optional(),
    uses: ItemUsesSchema.optional(),
    spells: z.record(z.string().regex(/^s_/u), ItemSpellAccessSchema).refine((value) => Object.keys(value).length > 0).optional(),
    spellcasting: ItemSpellcastingSchema.optional(),
    spellTemplate: ItemSpellTemplatesSchema.optional(),
    armor: z
      .object({
        ac: nonnegInt.optional(),
        stealthDisadvantage: z.literal(true).optional(),
        strength: nonnegInt.optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    weapon: z
      .object({
        damage: z.string().min(1).optional(),
        twoHandedDamage: z.string().min(1).optional(),
        damageType: z.string().min(1).optional(),
        range: z.string().min(1).optional(),
        properties: z.array(z.string().min(1)).min(1).optional(),
        mastery: WEAPON_MASTERY.optional(),
        ammo: AMMO_FAMILY.optional(),
      })
      .strict()
      .refine((value) => Object.keys(value).length > 0)
      .optional(),
    detail: z.string().min(1).optional(),
    modifiers: z.array(ModifierSchema).min(1).optional(),
    rolls: z.array(ItemRollSchema).min(1).optional(),
    description: z.union([z.string(), z.array(z.string()).min(1)]),
  })
  .strict()
  .superRefine((item, ctx) => {
    if (item.weapon && item.armor) {
      ctx.addIssue({ code: "custom", path: ["weapon"], message: "An item cannot be both weapon and armor" });
    }
    if (item.ammo && item.type !== "Ammo") {
      ctx.addIssue({ code: "custom", path: ["ammo"], message: "An ammunition family requires type Ammo" });
    }
    if (item.weapon?.ammo && !item.weapon.properties?.includes("A")) {
      ctx.addIssue({ code: "custom", path: ["weapon", "ammo"], message: "Weapon ammunition requires property A" });
    }
    if (item.ignoreWeight && !item.container) {
      ctx.addIssue({ code: "custom", path: ["ignoreWeight"], message: "ignoreWeight requires container" });
    }
  });
