import type { AbilityScoreEffect } from "@/domain/character/featureEffects";
import { parseFeatureEffects } from "@/domain/character/parseFeatureEffects";
import type { AbilKey } from "@/views/character/CharacterSheetTypes";

export const ABILITY_KEYS: AbilKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export const ABILITY_LABELS: Record<AbilKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export type ExtraFeatDetailLike = {
  id: string;
  name: string;
  text?: string | null;
};

export type ExtraFeatAbilityApplication = {
  featId: string;
  featName: string;
  ability: AbilKey;
  amount: number;
  maximum: number;
};

export type ExtraFeatAbilityChoiceSpec = {
  options: AbilKey[];
  allowedCounts: number[];
  effects: AbilityScoreEffect[];
};

function abilityEffects(feat: ExtraFeatDetailLike): AbilityScoreEffect[] {
  const text = String(feat.text ?? "").trim();
  if (!text) return [];
  return parseFeatureEffects({
    source: { id: `extra-feat:${feat.id}`, kind: "feat", name: feat.name, text },
    text,
  }).effects.filter((effect): effect is AbilityScoreEffect => effect.type === "ability_score");
}

export function getExtraFeatAbilityChoiceSpec(feat: ExtraFeatDetailLike | null): ExtraFeatAbilityChoiceSpec | null {
  if (!feat) return null;
  const effects = abilityEffects(feat).filter((effect) => effect.mode === "choice");
  if (effects.length === 0) return null;
  const options = Array.from(new Set(effects.flatMap((effect) => effect.chooseFrom ?? ABILITY_KEYS)));
  const allowedCounts = Array.from(new Set(effects.map((effect) => effect.choiceCount))).sort((a, b) => a - b);
  return { options, allowedCounts, effects };
}

export function isValidExtraFeatAbilityChoice(
  spec: ExtraFeatAbilityChoiceSpec | null,
  selected: AbilKey[],
): boolean {
  if (!spec) return selected.length === 0;
  const unique = Array.from(new Set(selected));
  return spec.effects.some((effect) =>
    effect.choiceCount === unique.length
    && unique.every((ability) => (effect.chooseFrom ?? ABILITY_KEYS).includes(ability))
  );
}

export function applyExtraFeatAbilityScores(
  baseScores: Record<AbilKey, number | null>,
  feats: ExtraFeatDetailLike[],
  choices: Record<string, string[]> | null | undefined,
): { scores: Record<AbilKey, number | null>; applications: ExtraFeatAbilityApplication[] } {
  const applications: ExtraFeatAbilityApplication[] = [];

  for (const feat of feats) {
    const effects = abilityEffects(feat);
    for (const effect of effects.filter((entry) => entry.mode === "fixed")) {
      if (!effect.ability) continue;
      applications.push({
        featId: feat.id,
        featName: feat.name,
        ability: effect.ability,
        amount: effect.amount,
        maximum: effect.maximum ?? 20,
      });
    }

    const selected = Array.from(new Set(
      (choices?.[feat.id] ?? [])
        .map((value) => String(value).trim().toLowerCase().slice(0, 3) as AbilKey)
        .filter((ability): ability is AbilKey => ABILITY_KEYS.includes(ability)),
    ));
    const selectedEffect = effects
      .filter((entry) => entry.mode === "choice")
      .find((effect) =>
        effect.choiceCount === selected.length
        && selected.every((ability) => (effect.chooseFrom ?? ABILITY_KEYS).includes(ability))
      );
    if (!selectedEffect) continue;
    for (const ability of selected) {
      applications.push({
        featId: feat.id,
        featName: feat.name,
        ability,
        amount: selectedEffect.amount,
        maximum: selectedEffect.maximum ?? 20,
      });
    }
  }

  applications.sort((a, b) => a.maximum - b.maximum);
  const scores = { ...baseScores };
  for (const application of applications) {
    const current = scores[application.ability];
    if (current == null) continue;
    scores[application.ability] = Math.min(application.maximum, current + application.amount);
  }
  return { scores, applications };
}
