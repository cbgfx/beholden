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
    grantsSpell?: string;
    grantsChoiceId?: string;
  }>;
  choices?: Array<{
    id?: string;
    type?: string;
    count?: number;
    options?: string[] | null;
    amount?: number | null;
    split?: true;
    maximum?: number | null;
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

/** Adds any `{type: <enum>, ...}`-shaped object verbatim as a real FeatureEffect — no parsing, no kind-based restriction. This is the one path that lets canonical data carry the full effect vocabulary (armor_class, defense, senses, etc.), not just the narrow source_modifier/source_proficiency shapes below. */
function addVerbatimEffects(rawEffects: unknown[], add: (effect: EffectWithoutIdentity) => void): void {
  for (const rawEffect of rawEffects) {
    if (!rawEffect || typeof rawEffect !== "object" || Array.isArray(rawEffect)) continue;
    const effect = rawEffect as Record<string, unknown>;
    if (!effect.type || typeof effect.type !== "string") continue;
    // Strip any id/source that may have been persisted, then re-stamp via add().
    const { id: _id, source: _source, ...rest } = effect;
    add(rest as EffectWithoutIdentity);
  }
}

export function structuredEffectsFromCanonical(args: {
  source: FeatureEffectSource;
  classEffects?: unknown[];
  classChoices?: unknown[];
  /** Verbatim FeatureEffect-shaped facts from a trait's own `effects` field (species/background traits). */
  traitEffects?: unknown[];
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

  if (args.traitEffects && args.traitEffects.length > 0) {
    addVerbatimEffects(args.traitEffects, add);
  }

  for (const rawEffect of args.classEffects ?? []) {
    const effect = record(rawEffect);
    if (typeof effect.type === "string" && effect.type) {
      const { id: _id, source: _source, ...rest } = effect;
      add(rest as EffectWithoutIdentity);
    }
  }

  for (const rawChoice of args.classChoices ?? []) {
    const choice = record(rawChoice);
    if (choice.kind === "selection") {
      add({
        type: "proficiency_grant",
        category: "selection",
        choice: {
          count: fixed(Number(choice.count ?? 1)),
          optionCategory: "selection",
          options: Array.isArray(choice.options) ? choice.options.map(String) : [],
          choiceLabel: String(choice.label ?? args.source.name),
        },
      });
      continue;
    }
    if (choice.kind === "proficiency") {
      const category = String(choice.category) as "skill" | "tool" | "language" | "saving_throw";
      const from = Array.isArray(choice.from) ? choice.from.map(String) : [];
      add({
        type: "proficiency_grant",
        category,
        choice: {
          count: fixed(Number(choice.count ?? 1)),
          optionCategory: category === "saving_throw" ? undefined : category,
          options: from.length ? from : undefined,
          ifProficient: choice.ifProficient ? String(choice.ifProficient) : undefined,
        },
      });
      continue;
    }
    if (choice.kind === "replacement" && typeof choice.target === "string" && ["maneuver", "metamagic", "fighting_style", "pact_boon"].includes(choice.target)) {
      add({
        type: "selection_replacement",
        target: choice.target as "maneuver" | "metamagic" | "fighting_style" | "pact_boon",
        count: fixed(Number(choice.count ?? 1)),
      });
      continue;
    }
    if (choice.kind !== "spell") continue;
    const mode = choice.mode === "prepared" ? "prepare" : choice.mode === "spellbook" ? "spellbook" : "learn";
    add({
      type: "spell_choice",
      choiceId: String(choice.id),
      mode,
      count: fixed(Number(choice.count ?? 1)),
      level: choice.level == null ? null : Number(choice.level),
      spellLists: Array.isArray(choice.lists) ? choice.lists.map(String) : [],
      schools: choice.school ? [String(choice.school)] : undefined,
      note: [
        choice.maxLevel == null ? "" : `Maximum spell level ${Number(choice.maxLevel)}`,
        choice.replace === true ? "May replace when the feature permits." : "",
        choice.perNewSlotLevel === true ? "Gain one additional choice whenever this class gains a new spell-slot level." : "",
      ].filter(Boolean).join(" ") || undefined,
      freeCast: choice.freeCast === true || undefined,
      ifKnown: choice.ifKnown ? String(choice.ifKnown) : undefined,
      canReplace: choice.replace === true || undefined,
    });
    if (choice.freeCast === true) {
      add({
        type: "resource_grant",
        resourceKey: String(choice.id),
        label: args.source.name,
        max: fixed(1),
        restoreAmount: "all",
      });
    }
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
    addVerbatimEffects(grants.effects ?? [], add);
  }

  const featUses = args.featMechanics?.uses ?? [];
  for (const [index, use] of featUses.entries()) {
    const max = use.countFrom === "proficiency_bonus"
      ? { kind: "proficiency_bonus" as const, min: use.minimum ?? undefined }
      : use.countFrom === "ability_modifier" && ability(use.ability)
        ? { kind: "ability_mod" as const, ability: ability(use.ability)!, min: use.minimum ?? undefined }
        : fixed(Number(use.count ?? 1));
    const resourceKey = `${args.source.id}:use:${index + 1}`;
    effects.push({
      id: createFeatureEffectId(args.source, "resource_grant", effects.length),
      source: args.source,
      type: "resource_grant",
      resourceKey,
      // The feature/feat's own name is the resource's title; `note` is explanatory prose
      // ("can cast it once without a spell slot"), not a label. Only fall back to it when a
      // single source grants more than one use pool and the name alone would collide.
      label: featUses.length > 1 ? `${args.source.name} (${index + 1})` : args.source.name,
      max,
      reset: use.recharge ?? "long_rest",
      restoreAmount: "all",
    });
    if (use.grantsSpell) {
      add({
        type: "spell_grant",
        spellName: use.grantsSpell,
        mode: "free_cast",
        castsWithoutSlot: true,
        resourceKey,
      });
    }
  }

  return effects;
}
