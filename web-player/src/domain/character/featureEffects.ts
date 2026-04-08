import type { AbilKey } from "@/views/character/CharacterSheetTypes";

export type FeatureSourceKind =
  | "class"
  | "subclass"
  | "species"
  | "background"
  | "feat"
  | "invocation"
  | "item"
  | "other";

export interface FeatureEffectSource {
  id: string;
  kind: FeatureSourceKind;
  name: string;
  level?: number | null;
  parentName?: string | null;
  text?: string | null;
}

export type EffectDuration =
  | "instant"
  | "passive"
  | "while_equipped"
  | "while_unarmored"
  | "while_not_heavy_armor"
  | "while_raging"
  | "while_wild_shaped"
  | "while_concentrating"
  | "until_end_of_turn"
  | "until_start_of_next_turn"
  | "until_end_of_next_turn"
  | "for_1_minute"
  | "special";

export type ResetKind =
  | "short_rest"
  | "long_rest"
  | "short_or_long_rest"
  | "initiative"
  | "turn_start"
  | "rage_start"
  | "never"
  | "special";

export type RoundingMode = "up" | "down";

export type WeaponFilter =
  | "simple_weapon"
  | "martial_weapon"
  | "melee_weapon"
  | "ranged_weapon"
  | "finesse_weapon"
  | "light_weapon"
  | "crossbow_weapon"
  | "light_crossbow"
  | "no_two_handed";

export type ScalingValue =
  | { kind: "fixed"; value: number }
  | { kind: "ability_mod"; ability: AbilKey; min?: number; max?: number }
  | { kind: "proficiency_bonus"; multiplier?: number; min?: number; max?: number }
  | { kind: "class_level"; className?: string | null; multiplier?: number; min?: number; max?: number }
  | { kind: "character_level"; multiplier?: number; min?: number; max?: number }
  | { kind: "half_class_level"; className?: string | null; round: RoundingMode; min?: number; max?: number }
  | { kind: "half_character_level"; round: RoundingMode; min?: number; max?: number }
  | { kind: "named_progression"; key: string };

export type ScalingDice =
  | { kind: "fixed"; dice: string }
  | { kind: "per_scalar"; scalar: ScalingValue; die: string }
  | { kind: "named_progression"; key: string };

export interface EffectGate {
  duration?: EffectDuration;
  /** "not_unarmored" = armor must be worn (Defense fighting style, etc.) */
  armorState?: "any" | "no_armor" | "not_heavy" | "not_unarmored";
  shieldAllowed?: boolean;
  weaponTag?: "melee" | "ranged" | "finesse" | "light" | "simple" | "martial";
  attackAbility?: AbilKey;
  weaponFilters?: WeaponFilter[];
  notes?: string;
}

export interface ChoiceSpec {
  count: ScalingValue;
  options?: string[];
  optionCategory?:
    | "skill"
    | "tool"
    | "language"
    | "weapon"
    | "weapon_mastery"
    | "spell"
    | "feat"
    | "subclass_option"
    | "damage_type";
  filters?: Array<"has_proficiency" | WeaponFilter>;
  canReplaceOnReset?: ResetKind;
}

interface FeatureEffectBase {
  id: string;
  source: FeatureEffectSource;
  summary?: string;
  gate?: EffectGate;
}

export interface ResourceGrantEffect extends FeatureEffectBase {
  type: "resource_grant";
  resourceKey: string;
  label: string;
  max: ScalingValue;
  reset: ResetKind;
  restoreAmount?: "all" | "one" | ScalingValue;
  linkedSpellName?: string;
}

export interface SpellGrantEffect extends FeatureEffectBase {
  type: "spell_grant";
  spellName: string;
  spellList?: string | null;
  mode: "known" | "always_prepared" | "at_will" | "free_cast" | "expanded_list";
  requiredLevel?: number;
  uses?: ScalingValue;
  reset?: ResetKind;
  castsWithoutSlot?: boolean;
  noMaterialComponents?: boolean;
  noConcentration?: boolean;
  resourceKey?: string;
  riderSummary?: string;
}

export interface SpellChoiceEffect extends FeatureEffectBase {
  type: "spell_choice";
  mode: "learn";
  count: ScalingValue;
  level: number;
  spellLists: string[];
  schools?: string[];
  note?: string;
}

export interface ProficiencyGrantEffect extends FeatureEffectBase {
  type: "proficiency_grant";
  category: "skill" | "tool" | "language" | "armor" | "weapon" | "saving_throw";
  grants?: string[];
  choice?: ChoiceSpec;
  expertise?: boolean;
}

export interface WeaponMasteryEffect extends FeatureEffectBase {
  type: "weapon_mastery";
  grants?: string[];
  choice?: ChoiceSpec;
}

export interface ArmorClassEffect extends FeatureEffectBase {
  type: "armor_class";
  mode: "base_formula" | "minimum_floor" | "bonus";
  base?: number;
  abilities?: AbilKey[];
  bonus?: ScalingValue;
}

export interface SpeedEffect extends FeatureEffectBase {
  type: "speed";
  mode: "bonus" | "set" | "grant_mode";
  amount?: ScalingValue;
  movementMode?: "walk" | "fly" | "swim" | "climb" | "burrow";
}

export interface DefenseEffect extends FeatureEffectBase {
  type: "defense";
  mode:
    | "damage_resistance"
    | "damage_immunity"
    | "condition_immunity"
    | "condition_advantage"
    | "save_advantage"
    | "save_disadvantage"
    | "attack_advantage"
    | "attack_disadvantage";
  targets: string[];
}

export interface ModifierEffect extends FeatureEffectBase {
  type: "modifier";
  target:
    | "ability_check"
    | "initiative"
    | "skill_check"
    | "saving_throw"
    | "attack_roll"
    | "spell_attack"
    | "spell_save_dc"
    | "passive_score";
  mode: "bonus" | "set_minimum" | "advantage" | "disadvantage" | "reroll";
  amount?: ScalingValue;
  appliesTo?: string[];
}

export interface HitPointEffect extends FeatureEffectBase {
  type: "hit_points";
  mode: "max_bonus" | "temp_hp" | "drop_to_floor" | "heal_pool";
  amount: ScalingValue | ScalingDice;
  reset?: ResetKind;
}

export interface AttackEffect extends FeatureEffectBase {
  type: "attack";
  mode:
    | "extra_attack"
    | "bonus_damage"
    | "damage_die_override"
    | "add_ability_to_damage"
    | "weapon_ability_override"
    | "replace_attack_with_cantrip"
    | "triggered_attack";
  amount?: ScalingValue | ScalingDice;
  ability?: AbilKey;
  damageType?: "same_as_attack" | string;
  frequency?: "once_per_turn" | "first_hit_each_turn" | "once_per_rage" | "special";
}

export interface CheckOverrideEffect extends FeatureEffectBase {
  type: "check_override";
  skills: string[];
  useAbility: AbilKey;
}

export interface ActionEffect extends FeatureEffectBase {
  type: "action";
  activation: "action" | "bonus_action" | "reaction" | "no_action";
  reset?: ResetKind;
  uses?: ScalingValue;
  actionKey?: string;
  description: string;
}

export interface SensesEffect extends FeatureEffectBase {
  type: "senses";
  mode: "grant";
  senses: Array<{ kind: "darkvision" | "blindsight" | "tremorsense" | "truesight"; range: number }>;
}

export interface ChoiceBundleEffect extends FeatureEffectBase {
  type: "choice_bundle";
  choice: ChoiceSpec;
  options: Array<{
    optionId: string;
    label: string;
    effects: FeatureEffect[];
  }>;
}

export interface NarrativeEffect extends FeatureEffectBase {
  type: "narrative";
  category: "reference" | "manual_resolution";
  description: string;
}

/**
 * Represents an ability score bonus granted by a feat or feature.
 *
 * mode "fixed"  — a specific ability is increased (e.g. Actor: +1 CHA).
 * mode "choice" — the player picks from a constrained set (chooseFrom) or
 *                 any ability (chooseFrom undefined); used for feats like
 *                 Athlete (+1 STR or DEX) and ASI free-choice.
 */
export interface AbilityScoreEffect extends FeatureEffectBase {
  type: "ability_score";
  mode: "fixed" | "choice";
  /** Set when mode === "fixed": which ability receives the bonus. */
  ability?: AbilKey;
  /** Set when mode === "choice" and the options are restricted (e.g. [str, dex]). */
  chooseFrom?: AbilKey[];
  /** How many abilities the player improves (default 1). */
  choiceCount: number;
  /** Points added to each chosen ability. */
  amount: number;
}

export type FeatureEffect =
  | AbilityScoreEffect
  | ResourceGrantEffect
  | SpellGrantEffect
  | SpellChoiceEffect
  | ProficiencyGrantEffect
  | WeaponMasteryEffect
  | ArmorClassEffect
  | SpeedEffect
  | DefenseEffect
  | ModifierEffect
  | HitPointEffect
  | AttackEffect
  | CheckOverrideEffect
  | ActionEffect
  | SensesEffect
  | ChoiceBundleEffect
  | NarrativeEffect;

export interface ParsedFeatureEffects {
  source: FeatureEffectSource;
  effects: FeatureEffect[];
  unmatchedText?: string[];
}

export const FEATURE_EFFECT_PRIORITIES: Record<FeatureEffect["type"], number> = {
  ability_score: 5,
  proficiency_grant: 10,
  weapon_mastery: 20,
  resource_grant: 30,
  spell_grant: 40,
  spell_choice: 45,
  armor_class: 50,
  speed: 60,
  senses: 70,
  defense: 80,
  modifier: 90,
  check_override: 100,
  hit_points: 110,
  attack: 120,
  action: 130,
  choice_bundle: 140,
  narrative: 999,
};

export const FEATURE_EFFECT_MODEL_NOTES = {
  goals: [
    "Represent common compendium patterns once and reuse them across classes, subclasses, feats, and invocations.",
    "Separate actionable sheet mechanics from narrative reference text.",
    "Prefer effect handlers per pattern, not per feature.",
  ],
  compendiumPatternsCovered: [
    "Free casts with short/long rest resets and ability-mod scaling.",
    "Always-prepared, at-will, and expanded-list spell grants.",
    "Resource pools like Rage, Channel Divinity, Bardic Inspiration, and Wild Shape.",
    "Skill/tool/language/armor/weapon/save proficiencies and Expertise.",
    "Weapon Mastery selections and rest-swappable weapon picks.",
    "Unarmored Defense, AC bonuses, speed bonuses, and movement modes.",
    "Resistances, immunities, advantage/disadvantage, and passive score modifiers.",
    "Attack riders like Sneak Attack, Rage Damage, Brutal Strike, and Extra Attack.",
    "Choice-driven feature bundles such as Wild Heart options, maneuvers, and subclass pick lists.",
  ],
  expectedEscapeHatches: [
    "Highly bespoke triggered effects with battlefield targeting or party coordination.",
    "Features that rewrite another subsystem rather than adding a local modifier.",
    "Narrative/reference-only feature text that should remain visible but not automated.",
  ],
} as const;

export function createFeatureEffectId(source: FeatureEffectSource, type: FeatureEffect["type"], index: number): string {
  return `${source.kind}:${source.id}:${type}:${index}`;
}
