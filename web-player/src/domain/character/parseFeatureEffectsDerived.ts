import type { AbilKey, GrantedSpellCast, ResourceCounter, TaggedItem } from "@/views/character/CharacterSheetTypes";
import type {
  ModifierEffect,
  ParsedFeatureEffects,
  ProficiencyGrantEffect,
  ScalingValue,
  SpellChoiceEffect,
  SpeedEffect,
} from "@/domain/character/featureEffects";
import {
  type EffectStateContext,
  isEffectActive,
  resolveScalingValueInContext,
} from "./parseFeatureEffectsDerivedHelpers";

export {
  canAddAbilityModifierToExtraAttackDamageFromEffects,
  canUseWeaponForBonusAttackFromEffects,
  collectSensesFromEffects,
  deriveAttackAbilityOverrideFromEffects,
  deriveAttackDamageBonusFromEffects,
  deriveAttackDamageDiceOverrideFromEffects,
  deriveAttackRollBonusFromEffects,
  deriveModifierStateFromEffects,
  deriveUnarmoredDefenseFromEffects,
} from "./parseFeatureEffectsDerived.attacks";

export function buildGrantedSpellDataFromEffects(
  parsed: ParsedFeatureEffects[],
  scores: Record<AbilKey, number | null>,
  level?: number | null,
): { spells: GrantedSpellCast[]; resources: ResourceCounter[] } {
  const spells: GrantedSpellCast[] = [];

  const resolveScalingValue = (value: ScalingValue | undefined): number | null =>
    resolveScalingValueInContext(value, { scores, level });

  const resourceByKey = new Map<string, ResourceCounter>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "resource_grant") {
        const max = resolveScalingValue(effect.max);
        if (max == null) continue;
        const reset =
          effect.reset === "short_rest" ? "S"
          : effect.reset === "long_rest" ? "L"
          : effect.reset === "short_or_long_rest" ? "SL"
          : "L";
        resourceByKey.set(effect.resourceKey, {
          key: effect.resourceKey,
          name: effect.label,
          current: max,
          max,
          reset,
          restoreAmount:
            effect.restoreAmount === "all" || effect.restoreAmount === "one"
              ? effect.restoreAmount
              : undefined,
        });
      }
    }
  }

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "spell_grant") continue;
      if (effect.requiredLevel != null && level != null && level < effect.requiredLevel) continue;
      if (effect.mode === "free_cast" && effect.resourceKey) {
        const resource = resourceByKey.get(effect.resourceKey);
        if (!resource) continue;
        spells.push({
          key: `granted-spell:${effect.resourceKey}`,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "limited",
          note: `Free cast ${resource.max} time${resource.max === 1 ? "" : "s"} per ${resource.reset === "S" ? "Short Rest" : resource.reset === "SL" ? "Short or Long Rest" : "Long Rest"}. No spell slot required.`,
          resourceKey: effect.resourceKey,
          reset: resource.reset,
        });
        continue;
      }

      if (effect.mode === "at_will") {
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "at_will",
          note: effect.riderSummary ?? "",
        });
        continue;
      }

      if (effect.mode === "known") {
        const isCantrip = /\bcantrip\b/i.test(effect.summary ?? "") || effect.requiredLevel === 0;
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "known",
          note: effect.riderSummary
            ? `${isCantrip ? "Known cantrip." : "Known spell."} ${effect.riderSummary}`
            : (isCantrip ? "Known cantrip." : "Known spell."),
        });
        continue;
      }

      if (effect.mode === "always_prepared") {
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "always_prepared",
          note: effect.riderSummary ? `Always prepared. ${effect.riderSummary}` : "Always prepared.",
        });
        continue;
      }

      if (effect.mode === "expanded_list") {
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "expanded_list",
          note: "Added to your spell list.",
        });
      }
    }
  }

  return { spells, resources: Array.from(resourceByKey.values()) };
}

export function collectTaggedGrantsFromEffects(parsed: ParsedFeatureEffects[]): {
  armor: TaggedItem[];
  weapons: TaggedItem[];
  tools: TaggedItem[];
  skills: TaggedItem[];
  expertise: TaggedItem[];
  saves: TaggedItem[];
  languages: TaggedItem[];
} {
  const result = {
    armor: [] as TaggedItem[],
    weapons: [] as TaggedItem[],
    tools: [] as TaggedItem[],
    skills: [] as TaggedItem[],
    expertise: [] as TaggedItem[],
    saves: [] as TaggedItem[],
    languages: [] as TaggedItem[],
  };

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "proficiency_grant" && effect.grants?.length) {
        const target =
          effect.expertise ? result.expertise
          : effect.category === "armor" ? result.armor
          : effect.category === "weapon" ? result.weapons
          : effect.category === "tool" ? result.tools
          : effect.category === "skill" ? result.skills
          : effect.category === "saving_throw" ? result.saves
          : effect.category === "language" ? result.languages
          : null;
        if (!target) continue;
        for (const name of effect.grants) target.push({ name, source: effect.source.name });
      }
      if (effect.type === "weapon_mastery" && effect.grants?.length) {
        for (const name of effect.grants) result.weapons.push({ name, source: effect.source.name });
      }
    }
  }

  return result;
}

export function collectSpellChoicesFromEffects(parsed: ParsedFeatureEffects[]): SpellChoiceEffect[] {
  const result: SpellChoiceEffect[] = [];
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "spell_choice") result.push(effect);
    }
  }
  return result;
}

export function collectProficiencyChoiceEffectsFromEffects(parsed: ParsedFeatureEffects[]): ProficiencyGrantEffect[] {
  const result: ProficiencyGrantEffect[] = [];
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "proficiency_grant" || !effect.choice || effect.choice.count.kind !== "fixed") continue;
      result.push(effect);
    }
  }
  return result;
}

export function collectDefensesFromEffects(parsed: ParsedFeatureEffects[], opts?: EffectStateContext): {
  resistances: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
} {
  const resistances = new Set<string>();
  const damageImmunities = new Set<string>();
  const conditionImmunities = new Set<string>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "defense") continue;
      if (!isEffectActive(effect, opts)) continue;
      if (effect.mode === "damage_resistance") {
        effect.targets.forEach((target) => resistances.add(target));
      }
      if (effect.mode === "damage_immunity") {
        effect.targets.forEach((target) => damageImmunities.add(target));
      }
      if (effect.mode === "condition_immunity") {
        effect.targets.forEach((target) => conditionImmunities.add(target));
      }
    }
  }

  return {
    resistances: Array.from(resistances),
    damageImmunities: Array.from(damageImmunities),
    conditionImmunities: Array.from(conditionImmunities),
  };
}

export function deriveSpeedBonusFromEffects(parsed: ParsedFeatureEffects[], opts?: { armorState?: "any" | "no_armor" | "not_heavy"; raging?: boolean }): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "speed" || effect.mode !== "bonus") continue;
      if (!isEffectActive(effect, opts)) continue;
      if (effect.amount?.kind === "fixed") total += effect.amount.value;
    }
  }
  return total;
}

export function collectMovementModesFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: { baseWalkSpeed?: number; raging?: boolean; armorState?: "any" | "no_armor" | "not_heavy" }
): Array<{ mode: Exclude<SpeedEffect["movementMode"], "walk" | undefined>; speed: number | null }> {
  const bestByMode = new Map<Exclude<SpeedEffect["movementMode"], "walk" | undefined>, number | null>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "speed" || effect.mode !== "grant_mode" || !effect.movementMode || effect.movementMode === "walk") continue;
      if (!isEffectActive(effect, opts)) continue;
      const mode = effect.movementMode;
      const amount = effect.amount;
      const resolved =
        amount?.kind === "fixed" ? amount.value
        : amount?.kind === "named_progression" && amount.key === "equal_to_speed" ? (opts?.baseWalkSpeed ?? null)
        : null;
      const existing = bestByMode.get(mode);
      if (existing == null || (resolved != null && resolved > existing)) bestByMode.set(mode, resolved);
    }
  }

  return Array.from(bestByMode.entries()).map(([mode, speed]) => ({ mode, speed }));
}

export function deriveArmorClassBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: {
    armorEquipped?: boolean;
    armorCategory?: "light" | "medium" | "heavy" | "shield" | "none";
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
  }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "armor_class" || effect.mode !== "bonus") continue;
      const gateArmorState = effect.gate?.armorState ?? "any";
      if (gateArmorState === "not_unarmored" && !opts?.armorEquipped) continue;
      if (gateArmorState === "no_armor" && opts?.armorEquipped) continue;
      if (effect.gate?.notes?.startsWith("medium_armor_dex_cap:")) {
        if (opts?.armorCategory !== "medium") continue;
        const minimumDex = Number(effect.gate.notes.split(":")[1] ?? 0);
        const dexScore = opts?.scores?.dex ?? 10;
        if (dexScore < minimumDex) continue;
      }
      const resolved = resolveScalingValueInContext(effect.bonus, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function deriveHitPointMaxBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: { level?: number | null; scores?: Partial<Record<AbilKey, number | null>> }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "hit_points" || effect.mode !== "max_bonus") continue;
      if (
        !("kind" in effect.amount)
        || effect.amount.kind === "per_scalar"
        || ("dice" in effect.amount)
      ) continue;
      const resolved = resolveScalingValueInContext(effect.amount, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function deriveModifierBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  target: ModifierEffect["target"],
  opts?: {
    appliesTo?: string;
    level?: number | null;
    scores?: Partial<Record<AbilKey, number | null>>;
    raging?: boolean;
  }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "modifier" || effect.target !== target || effect.mode !== "bonus") continue;
      if (!isEffectActive(effect, { raging: opts?.raging })) continue;
      if (effect.appliesTo?.length && opts?.appliesTo && !effect.appliesTo.some((value) => value.toLowerCase() === opts.appliesTo?.toLowerCase())) continue;
      if (effect.appliesTo?.length && !opts?.appliesTo) continue;
      const resolved = resolveScalingValueInContext(effect.amount, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

