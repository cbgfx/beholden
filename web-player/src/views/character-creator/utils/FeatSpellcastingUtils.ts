import type { AbilKey, TaggedItem } from "@/views/character/CharacterSheetTypes";
import type { ParsedFeatChoiceLike, ParsedFeatDetailLike } from "./FeatChoiceTypes";

type SpellOptionLike = {
  id: string;
  name: string;
};

const ABILITY_OPTION_LABELS = [
  "Strength",
  "Dexterity",
  "Constitution",
  "Intelligence",
  "Wisdom",
  "Charisma",
] as const;

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

function parseSpellcastingAbilityOptionsFromText(text: string | null | undefined): string[] {
  const normalized = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const match = normalized.match(
    /((?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)(?:,\s*(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma))*\s*,?\s*or\s*(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)) is your spellcasting ability for (?:this|these) spell/i
  );
  if (!match) return [];
  const abilities = (match[1] ?? "")
    .replace(/\s+or\s+/i, ", ")
    .split(/\s*,\s*/)
    .map((value) => value.trim())
    .filter((value): value is typeof ABILITY_OPTION_LABELS[number] =>
      (ABILITY_OPTION_LABELS as readonly string[]).includes(value)
    );
  return [...new Set(abilities)];
}

export function getFeatSpellcastingAbilityChoice(
  feat: ParsedFeatDetailLike,
): ParsedFeatChoiceLike | null {
  const parsedChoiceId = feat.parsed.spellcastingAbilityFromChoiceId;
  if (parsedChoiceId) {
    const parsedChoice = (feat.parsed.choices ?? []).find(
      (choice) => choice.id === parsedChoiceId && choice.type === "ability_score"
    );
    if (parsedChoice) return parsedChoice;
  }

  const options = parseSpellcastingAbilityOptionsFromText(feat.text);
  if (options.length < 2) return null;
  return {
    id: "spellcasting_ability",
    type: "ability_score",
    count: 1,
    options,
    note: "Choose the spellcasting ability for spells granted by this feat.",
  };
}

export function resolveFeatSpellcastingAbility(args: {
  feat: ParsedFeatDetailLike;
  selectedChoices?: Record<string, string[]>;
  getChoiceKey?: (choice: ParsedFeatChoiceLike) => string;
}): AbilKey | null {
  const { feat, selectedChoices = {}, getChoiceKey } = args;
  const abilityChoice = getFeatSpellcastingAbilityChoice(feat);
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

export interface SelectedFeatSpellcastingAbilityChoiceEntry {
  key: string;
  title: string;
  sourceLabel: string;
  options: string[];
  chosen: string[];
  max: number;
  note?: string | null;
}

export function buildSelectedFeatSpellcastingAbilityChoices(args: {
  selectedChoices?: Record<string, string[]>;
  bgOriginFeatDetail?: ParsedFeatDetailLike | null;
  raceFeatDetail?: ParsedFeatDetailLike | null;
  classFeatDetails?: Record<string, ParsedFeatDetailLike>;
  levelUpFeatDetails?: Array<{ level: number; featId: string; feat: ParsedFeatDetailLike }>;
}): SelectedFeatSpellcastingAbilityChoiceEntry[] {
  const {
    selectedChoices = {},
    bgOriginFeatDetail = null,
    raceFeatDetail = null,
    classFeatDetails = {},
    levelUpFeatDetails = [],
  } = args;

  const entries: SelectedFeatSpellcastingAbilityChoiceEntry[] = [];

  const pushEntry = (
    feat: ParsedFeatDetailLike | null | undefined,
    keyPrefix: string,
    sourceLabel: string,
  ) => {
    if (!feat) return;
    const choice = getFeatSpellcastingAbilityChoice(feat);
    if (!choice) return;
    const key = `${keyPrefix}:${choice.id}`;
    entries.push({
      key,
      title: "Spellcasting Ability",
      sourceLabel,
      options: choice.options ?? [],
      chosen: selectedChoices[key] ?? [],
      max: Math.max(1, Number(choice.count ?? 1) || 1),
      note: choice.note,
    });
  };

  pushEntry(bgOriginFeatDetail, `bg:${bgOriginFeatDetail?.name ?? ""}`, bgOriginFeatDetail?.name ?? "");
  pushEntry(raceFeatDetail, `race:${raceFeatDetail?.name ?? ""}`, raceFeatDetail?.name ?? "");

  for (const [featureName, feat] of Object.entries(classFeatDetails)) {
    pushEntry(feat, `classfeat:${featureName}`, featureName);
  }

  for (const detail of levelUpFeatDetails) {
    pushEntry(detail.feat, `levelupfeat:${detail.level}:${detail.featId}`, `Level ${detail.level}: ${detail.feat.name}`);
  }

  return entries.filter((entry) => entry.options.length > 0);
}
