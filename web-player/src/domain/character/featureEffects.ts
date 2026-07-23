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

type EffectDuration =
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

type RoundingMode = "up" | "down";

export type WeaponFilter =
  | "simple_weapon"
  | "martial_weapon"
  | "melee_weapon"
  | "ranged_weapon"
  | "finesse_weapon"
  | "light_weapon"
  | "heavy_weapon"
  | "crossbow_weapon"
  | "longbow_or_shortbow"
  | "light_crossbow"
  | "no_two_handed"
  | "thrown_weapon"
  | "magic_weapon"
  | "no_offhand";

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

interface EffectGate {
  duration?: EffectDuration;
  /** "not_unarmored" = armor must be worn (Defense fighting style, etc.) */
  armorState?: "any" | "no_armor" | "not_heavy" | "not_unarmored";
  shieldAllowed?: boolean;
  weaponTag?: "melee" | "ranged" | "finesse" | "light" | "simple" | "martial";
  attackAbility?: AbilKey;
  weaponFilters?: WeaponFilter[];
  notes?: string;
}

interface ChoiceSpec {
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
    | "damage_type"
    | "selection";
  choiceLabel?: string;
  filters?: Array<"has_proficiency" | WeaponFilter>;
  canReplaceOnReset?: ResetKind;
  ifProficient?: string;
}

interface FeatureEffectBase {
  id: string;
  source: FeatureEffectSource;
  summary?: string;
  gate?: EffectGate;
  resolution?: "automatic" | "manual";
  /** Character level required before this effect applies (e.g. a species trait gained at level 5). Omit for effects active from level 1. */
  requiredLevel?: number;
}

interface ResourceGrantEffect extends FeatureEffectBase {
  type: "resource_grant";
  resourceKey: string;
  label: string;
  max: ScalingValue;
  /** Long rest is the default and is omitted in canonical data. */
  reset?: ResetKind;
  restoreAmount?: "all" | "one" | ScalingValue;
  linkedSpellName?: string;
}

interface SpellGrantEffect extends FeatureEffectBase {
  type: "spell_grant";
  spellName: string;
  spellId?: string;
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
  mode: "learn" | "prepare" | "spellbook" | "select";
  choiceId?: string;
  count: ScalingValue;
  level: number | null;
  spellLists: string[];
  schools?: string[];
  note?: string;
  freeCast?: boolean;
  ifKnown?: string;
  /** This choice replaces an existing class selection instead of increasing the known total. */
  canReplace?: boolean;
  /** Typed eligibility facts; never infer these from labels or notes. */
  filters?: { damage?: true; attack?: true; ritual?: true; known?: true };
}

export interface SelectionReplacementEffect extends FeatureEffectBase {
  type: "selection_replacement";
  target: "maneuver" | "metamagic" | "fighting_style" | "pact_boon";
  count: ScalingValue;
}

export interface ProficiencyGrantEffect extends FeatureEffectBase {
  type: "proficiency_grant";
  category: "skill" | "tool" | "language" | "armor" | "weapon" | "saving_throw" | "initiative" | "selection";
  grants?: string[];
  weaponFilter?: {
    melee?: true;
    martial?: true;
    excludeProperties?: Array<"heavy" | "two_handed">;
  };
  choice?: ChoiceSpec;
  expertise?: boolean;
}

interface WeaponMasteryEffect extends FeatureEffectBase {
  type: "weapon_mastery";
  grants?: string[];
  choice?: ChoiceSpec;
}

interface ArmorClassEffect extends FeatureEffectBase {
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

interface DefenseEffect extends FeatureEffectBase {
  type: "defense";
  mode:
    | "damage_resistance"
    | "damage_immunity"
    | "condition_immunity"
    | "condition_advantage"
    | "save_advantage"
    | "save_disadvantage"
    | "attack_advantage"
    | "attack_disadvantage"
    /** Advantage on the ability check made to end/escape a condition (distinct from condition_advantage, which is a saving throw). e.g. Goliath's Powerful Build ending Grappled. */
    | "escape_check_advantage";
  targets: string[];
  /** Narrows a condition_immunity to only specific causes (e.g. Warforged's Tireless: exhaustion from dehydration/malnutrition/suffocation only, not every exhaustion source). Omit for an unconditional immunity. */
  causeFilter?: string[];
}

export interface ModifierEffect extends FeatureEffectBase {
  type: "modifier";
  target:
    | "ability_check"
    | "initiative"
    | "skill_check"
    | "saving_throw"
    | "attack_roll"
    | "damage_roll"
    | "spell_attack"
    | "spell_save_dc"
    | "passive_score"
    /** Any d20 Test (attack roll, ability check, or saving throw) — broader than a single target, e.g. Halfling Luck. */
    | "any_d20_test"
    /** Carrying capacity only (not other size-dependent rules). e.g. Goliath's Powerful Build. No consumer reads this today — the app has no encumbrance system — but the fact is typed and ready. */
    | "carrying_capacity";
  mode: "bonus" | "set_minimum" | "advantage" | "disadvantage" | "reroll";
  amount?: ScalingValue;
  appliesTo?: string[];
}

interface HitPointEffect extends FeatureEffectBase {
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
  alternateAmount?: ScalingDice;
  alternateWhen?: "no_weapon_or_shield";
  ability?: AbilKey;
  damageType?: "same_as_attack" | string;
  frequency?: "once_per_turn" | "first_hit_each_turn" | "once_per_rage" | "special";
}

interface CheckOverrideEffect extends FeatureEffectBase {
  type: "check_override";
  skills: string[];
  useAbility: AbilKey;
}

interface ActionEffect extends FeatureEffectBase {
  type: "action";
  activation: "action" | "bonus_action" | "reaction" | "no_action";
  reset?: ResetKind;
  uses?: ScalingValue;
  actionKey?: string;
  description: string;
}

export interface SensesEffect extends FeatureEffectBase {
  type: "senses";
  mode: "grant" | "bonus";
  senses: Array<{ kind: "darkvision" | "blindsight" | "tremorsense" | "truesight" | "devils_sight"; range: number }>;
}

interface BreathingEffect extends FeatureEffectBase {
  type: "breathing";
  medium: "water";
}

interface ChoiceBundleEffect extends FeatureEffectBase {
  type: "choice_bundle";
  choice: ChoiceSpec;
  options: Array<{
    optionId: string;
    label: string;
    effects: FeatureEffect[];
  }>;
}

interface NarrativeEffect extends FeatureEffectBase {
  type: "narrative";
  category: "reference" | "manual_resolution";
  description: string;
}

interface FeatChoiceEffect extends FeatureEffectBase {
  type: "feat_choice";
  mode: "learn";
  choiceId?: string;
  count: ScalingValue;
  /** Restricts the pool this choice draws from (e.g. "origin" for Human's Versatile). Omit for any qualifying feat. */
  category?: "origin" | "general" | "fighting_style" | "epic_boon";
}

interface RestRuleEffect extends FeatureEffectBase {
  type: "rest_rule";
  mode: "long_rest_duration" | "no_sleep_required";
  /** Set when mode === "long_rest_duration": the reduced number of hours (e.g. Warforged's Sentry's Rest: 6). */
  hours?: number;
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
  /**
   * fixed      — a specific ability is increased (e.g. Actor: +1 CHA).
   * choice     — the player picks from a constrained set; used for ASI / feats.
   * set_minimum — while this effect is active the ability score cannot fall below
   *               `amount` (used for items like Amulet of Health, Belt of Giant Strength).
   */
  mode: "fixed" | "choice" | "set_minimum";
  /** Set when mode === "fixed" or "set_minimum": the ability affected. */
  ability?: AbilKey;
  /** Set when mode === "choice" and the options are restricted (e.g. [str, dex]). */
  chooseFrom?: AbilKey[];
  /** How many abilities the player improves (default 1). Not meaningful for set_minimum. */
  choiceCount: number;
  /** For fixed/choice: points added. For set_minimum: the floor value (e.g. 19). */
  amount: number;
  /** Maximum score this increase can produce (normally 20, or 30 for epic boons). Not used for set_minimum. */
  maximum?: number;
}

export type FeatureEffect =
  | AbilityScoreEffect
  | ResourceGrantEffect
  | SpellGrantEffect
  | SpellChoiceEffect
  | SelectionReplacementEffect
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
  | BreathingEffect
  | ChoiceBundleEffect
  | NarrativeEffect
  | FeatChoiceEffect
  | RestRuleEffect;

export interface ParsedFeatureEffects {
  source: FeatureEffectSource;
  effects: FeatureEffect[];
  unmatchedText?: string[];
}

export function createFeatureEffectId(source: FeatureEffectSource, type: FeatureEffect["type"], index: number): string {
  return `${source.kind}:${source.id}:${type}:${index}`;
}
