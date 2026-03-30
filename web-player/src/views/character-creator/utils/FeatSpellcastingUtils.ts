import type { AbilKey, TaggedItem } from "@/views/character/CharacterSheetTypes";
import type { ParsedFeatChoiceLike, ParsedFeatDetailLike } from "./FeatChoiceTypes";

type SpellOptionLike = {
  id: string;
  name: string;
};

function toAbilityKey(value: string | null | undefined): AbilKey | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "strength" || normalized === "str") return "str";
  if (normalized === "dexterity" || normalized === "dex") return "dex";
  if (normalized === "constitution" || normalized === "con") return "con";
  if (normalized === "intelligence" || normalized === "int") return "int";
  if (normalized === "wisdom" || normalized === "wis") return "wis";
  if (normalized === "charisma" || normalized === "cha") return "cha";
  return null;
}

export function resolveFeatSpellcastingAbility(args: {
  feat: ParsedFeatDetailLike;
  selectedChoices?: Record<string, string[]>;
  getChoiceKey?: (choice: ParsedFeatChoiceLike) => string;
}): AbilKey | null {
  const { feat, selectedChoices = {}, getChoiceKey } = args;
  const abilityChoiceId = feat.parsed.spellcastingAbilityFromChoiceId;
  if (!abilityChoiceId) return null;
  const abilityChoice = (feat.parsed.choices ?? []).find((choice) => choice.id === abilityChoiceId && choice.type === "ability_score");
  if (!abilityChoice) return null;
  const key = getChoiceKey ? getChoiceKey(abilityChoice) : abilityChoice.id;
  const selected = selectedChoices[key] ?? [];
  for (const value of selected) {
    const abilityKey = toAbilityKey(value);
    if (abilityKey) return abilityKey;
  }
  return null;
}

export function resolveFeatSpellEntries(args: {
  feat: ParsedFeatDetailLike;
  sourceLabel?: string;
  selectedChoices?: Record<string, string[]>;
  getChoiceKey?: (choice: ParsedFeatChoiceLike) => string;
  spellChoiceOptionsByKey?: Record<string, SpellOptionLike[]>;
}): TaggedItem[] {
  const {
    feat,
    selectedChoices = {},
    getChoiceKey,
    spellChoiceOptionsByKey = {},
  } = args;

  const source = args.sourceLabel ?? feat.name;
  const ability = resolveFeatSpellcastingAbility({ feat, selectedChoices, getChoiceKey });
  const entries: TaggedItem[] = [
    ...feat.parsed.grants.cantrips.map((name) => ({ name, source, ability })),
    ...feat.parsed.grants.spells.map((name) => ({ name, source, ability })),
  ];

  for (const choice of feat.parsed.choices ?? []) {
    if (choice.type !== "spell") continue;
    const key = getChoiceKey ? getChoiceKey(choice) : choice.id;
    const selected = selectedChoices[key] ?? [];
    const options = spellChoiceOptionsByKey[key] ?? [];

    for (const value of selected) {
      const option = options.find((entry) => entry.id === value || entry.name === value);
      entries.push({
        name: option?.name ?? value,
        source,
        id: option?.id ? String(option.id) : undefined,
        ability,
        sourceKey: key,
      });
    }
  }

  return entries;
}
