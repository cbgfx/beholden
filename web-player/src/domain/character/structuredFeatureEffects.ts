import {
  createFeatureEffectId,
  type FeatureEffect,
  type FeatureEffectSource,
  type ResetKind,
} from "@/domain/character/featureEffects";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";

type JsonRecord = Record<string, unknown>;
type EffectWithoutIdentity<T = FeatureEffect> =
  T extends FeatureEffect ? Omit<T, "id" | "source"> : never;

export interface StructuredFeatMechanicsLike {
  grants?: {
    skills?: string[];
    tools?: string[];
    languages?: string[];
    armor?: string[];
    weapons?: string[];
    savingThrows?: string[];
    spells?: string[];
    cantrips?: string[];
    abilityIncreases?: Record<string, number>;
    /** Pre-computed FeatureEffect-compatible objects from parseFeatStructuredEffects(). */
    effects?: unknown[];
  };
  uses?: Array<{
    count?: number;
    countFrom?: "proficiency_bonus" | "ability_modifier";
    ability?: string | null;
    minimum?: number | null;
    recharge?: ResetKind | null;
    note?: string;
  }>;
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(String).map((entry) => entry.trim()).filter(Boolean)
    : [];
}

function ability(value: unknown): AbilKey | null {
  const normalized = String(value ?? "").trim().toLowerCase().slice(0, 3) as AbilKey;
  return ["str", "dex", "con", "int", "wis", "cha"].includes(normalized)
    ? normalized
    : null;
}

function fixed(value: number) {
  return { kind: "fixed" as const, value };
}

export function structuredEffectsFromCanonical(args: {
  source: FeatureEffectSource;
  classEffects?: unknown[];
  featMechanics?: StructuredFeatMechanicsLike | null;
}): FeatureEffect[] {
  const effects: FeatureEffect[] = [];
  const add = (effect: EffectWithoutIdentity) => {
    effects.push({
      ...effect,
      id: createFeatureEffectId(args.source, effect.type, effects.length),
      source: args.source,
    } as FeatureEffect);
  };

  for (const rawEffect of args.classEffects ?? []) {
    const effect = record(rawEffect);
    const kind = String(effect.kind ?? "");
    const value = String(effect.value ?? "").trim();
    if (kind === "source_modifier") {
      const match = value.match(/^(speed|hp|strength|dexterity|constitution|intelligence|wisdom|charisma)\s*([+-]\d+)$/iu);
      const amount = Number(match?.[2]);
      if (match?.[1] && Number.isFinite(amount)) {
        const target = match[1].toLowerCase();
        if (target === "speed") {
          add({ type: "speed", mode: "bonus", amount: fixed(amount) });
          continue;
        }
        if (target === "hp") {
          add({ type: "hit_points", mode: "max_bonus", amount: fixed(amount) });
          continue;
        }
        const abilityKey = ability(target);
        if (abilityKey) {
          add({
            type: "ability_score",
            mode: "fixed",
            ability: abilityKey,
            choiceCount: 1,
            amount,
            maximum: 30,
          });
          continue;
        }
      }
    }
    if (kind === "source_proficiency") {
      const grouped = new Map<"skill" | "saving_throw", string[]>();
      for (const name of value.split(",").map((part) => part.trim()).filter(Boolean)) {
        const abilityKey = ability(name);
        const category = abilityKey ? "saving_throw" : "skill";
        const grants = grouped.get(category) ?? [];
        grants.push(abilityKey ?? name);
        grouped.set(category, grants);
      }
      for (const [category, grants] of grouped) {
        add({ type: "proficiency_grant", category, grants });
      }
      continue;
    }
    add({
      type: "narrative",
      category: "reference",
      description: [String(effect.description ?? "").trim(), value].filter(Boolean).join(": "),
    });
  }

  const grants = args.featMechanics?.grants;
  if (grants) {
    const proficiencyGroups = [
      ["skill", grants.skills],
      ["tool", grants.tools],
      ["language", grants.languages],
      ["armor", grants.armor],
      ["weapon", grants.weapons],
      ["saving_throw", grants.savingThrows],
    ] as const;
    for (const [category, values] of proficiencyGroups) {
      const entries = strings(values);
      if (entries.length > 0) add({ type: "proficiency_grant", category, grants: entries });
    }
    for (const spellName of [...strings(grants.spells), ...strings(grants.cantrips)]) {
      add({ type: "spell_grant", spellName, mode: "known" });
    }
    for (const [name, rawAmount] of Object.entries(grants.abilityIncreases ?? {})) {
      const abilityKey = ability(name);
      const amount = Number(rawAmount);
      if (!abilityKey || !Number.isFinite(amount)) continue;
      add({
        type: "ability_score",
        mode: "fixed",
        ability: abilityKey,
        choiceCount: 1,
        amount,
        maximum: 20,
      });
    }

    // Pass pre-computed structured effects from parseFeatStructuredEffects() through
    // as structured fallbacks. id and source are stamped on by add().
    for (const rawEffect of (grants.effects ?? [])) {
      if (!rawEffect || typeof rawEffect !== "object" || Array.isArray(rawEffect)) continue;
      const effect = rawEffect as Record<string, unknown>;
      if (!effect.type || typeof effect.type !== "string") continue;
      // Strip any id/source that may have been persisted, then re-stamp via add().
      const { id: _id, source: _source, ...rest } = effect;
      add(rest as EffectWithoutIdentity);
    }
  }

  for (const [index, use] of (args.featMechanics?.uses ?? []).entries()) {
    const max = use.countFrom === "proficiency_bonus"
      ? { kind: "proficiency_bonus" as const, min: use.minimum ?? undefined }
      : use.countFrom === "ability_modifier" && ability(use.ability)
        ? { kind: "ability_mod" as const, ability: ability(use.ability)!, min: use.minimum ?? undefined }
        : fixed(Number(use.count ?? 1));
    effects.push({
      id: createFeatureEffectId(args.source, "resource_grant", effects.length),
      source: args.source,
      type: "resource_grant",
      resourceKey: `${args.source.id}:use:${index + 1}`,
      label: String(use.note ?? args.source.name),
      max,
      reset: use.recharge ?? "special",
      restoreAmount: "all",
    });
  }

  return effects;
}
