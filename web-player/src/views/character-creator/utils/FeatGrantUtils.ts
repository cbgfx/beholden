import type { TaggedItem } from "@/views/character/CharacterSheetTypes";
import { classifyFeatSelection } from "./CharacterCreatorUtils";
import type { ParsedFeatChoiceLike as FeatGrantChoiceLike, ParsedFeatDetailLike as FeatGrantDetailLike } from "./FeatChoiceTypes";

export interface FeatGrantTaggedEntry extends TaggedItem {}

export interface FeatGrantCollections {
  skills: FeatGrantTaggedEntry[];
  tools: FeatGrantTaggedEntry[];
  languages: FeatGrantTaggedEntry[];
  armor: FeatGrantTaggedEntry[];
  weapons: FeatGrantTaggedEntry[];
  saves: FeatGrantTaggedEntry[];
  masteries: FeatGrantTaggedEntry[];
  spells: FeatGrantTaggedEntry[];
  expertise: FeatGrantTaggedEntry[];
}

export function collectFeatTaggedEntries(args: {
  feat: FeatGrantDetailLike;
  sourceLabel?: string;
  selectedChoices?: Record<string, string[]>;
  getChoiceKey?: (choice: FeatGrantChoiceLike) => string;
  resolveSelectedValue?: (choice: FeatGrantChoiceLike, key: string, value: string) => string | null;
}): FeatGrantCollections {
  const { feat, selectedChoices = {}, getChoiceKey, resolveSelectedValue } = args;
  const source = args.sourceLabel ?? feat.name;
  const result: FeatGrantCollections = {
    skills: feat.parsed.grants.skills.map((name) => ({ name, source })),
    tools: feat.parsed.grants.tools.map((name) => ({ name, source })),
    languages: feat.parsed.grants.languages.map((name) => ({ name, source })),
    armor: feat.parsed.grants.armor.map((name) => ({ name, source })),
    weapons: feat.parsed.grants.weapons.map((name) => ({ name, source })),
    saves: feat.parsed.grants.savingThrows.map((name) => ({ name, source })),
    masteries: [],
    spells: [
      ...feat.parsed.grants.cantrips.map((name) => ({ name, source })),
      ...feat.parsed.grants.spells.map((name) => ({ name, source })),
    ],
    expertise: [],
  };

  for (const choice of feat.parsed.choices ?? []) {
    const key = getChoiceKey ? getChoiceKey(choice) : choice.id;
    const selected = selectedChoices[key] ?? [];
    for (const value of selected) {
      const name = resolveSelectedValue?.(choice, key, value) ?? value;
      if (!name) continue;
      const kind = classifyFeatSelection(choice, name);
      if (kind === "skill") result.skills.push({ name, source });
      else if (kind === "tool") result.tools.push({ name, source });
      else if (kind === "language") result.languages.push({ name, source });
      else if (kind === "armor") result.armor.push({ name, source });
      else if (kind === "weapon") result.weapons.push({ name, source });
      else if (kind === "saving_throw") result.saves.push({ name, source });
      else if (kind === "weapon_mastery") result.masteries.push({ name, source });
      if (choice.type === "expertise") result.expertise.push({ name, source });
      if (choice.type === "spell") result.spells.push({ name, source });
    }
  }

  return result;
}
