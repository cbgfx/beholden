import React from "react";
import { api } from "@/services/api";
import { getFeatChoiceOptions } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { getFeatSpellcastingAbilityChoice } from "@/views/character-creator/utils/FeatSpellcastingUtils";
import { buildResolvedSpellChoiceEntry, loadSpellChoiceOptions } from "@/views/character-creator/utils/SpellChoiceUtils";
import { selectedInvocationFeatIds, type InvocationFeatChoiceEntry } from "@/domain/character/invocationFeatChoices";
import type { ParsedFeatChoiceLike, ParsedFeatDetailLike } from "@/views/character-creator/utils/FeatChoiceTypes";

type Detail = ParsedFeatDetailLike<ParsedFeatChoiceLike> & { id: string };
type NestedFeatChoiceGroup = { key: string; title: string; sourceLabel: string; count: number; options: string[]; note?: string | null };
type NestedFeatSpellChoice = ReturnType<typeof buildResolvedSpellChoiceEntry>;

export function useInvocationGrantedFeatChoices(args: {
  ruleset: "5e" | "5.5e";
  choices: InvocationFeatChoiceEntry[];
  selectedOptions: Record<string, string[]>;
  level: number;
}) {
  const { ruleset, choices, selectedOptions, level } = args;
  const featIds = React.useMemo(() => selectedInvocationFeatIds(choices, selectedOptions), [choices, selectedOptions]);
  const [details, setDetails] = React.useState<Detail[]>([]);
  const [spellOptions, setSpellOptions] = React.useState<Record<string, Array<{ id: string; name: string }>>>({});

  React.useEffect(() => {
    if (featIds.length === 0) { setDetails([]); return; }
    setDetails([]);
    let alive = true;
    api<{ rows: Array<{ id: string; feat: Detail | null }> }>("/api/compendium/feats/lookup", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: featIds, ruleset }),
    }).then((payload) => {
      if (alive) setDetails((payload.rows ?? []).flatMap((row) => row.feat ? [{ ...row.feat, id: row.id }] : []));
    }).catch(() => { if (alive) setDetails([]); });
    return () => { alive = false; };
  }, [featIds, ruleset]);

  const nested = React.useMemo(() => {
    const groups: NestedFeatChoiceGroup[] = [];
    const spells: NestedFeatSpellChoice[] = [];
    for (const feat of details) {
      const authored = [...(feat.parsed?.choices ?? [])];
      const abilityChoice = getFeatSpellcastingAbilityChoice(feat);
      if (abilityChoice && !authored.some((choice) => choice.id === abilityChoice.id)) authored.push(abilityChoice);
      for (const choice of authored) {
        const key = `extra:${feat.id}:${choice.id}`;
        if (choice.type === "spell") {
          spells.push(buildResolvedSpellChoiceEntry({
            key, choice, level, sourceLabel: feat.name, chosenOptions: selectedOptions,
            linkedChoiceKey: choice.linkedTo ? `extra:${feat.id}:${choice.linkedTo}` : null,
          }));
          continue;
        }
        groups.push({
          key,
          title: choice.type === "spell_list" ? "Spell List" : feat.name,
          sourceLabel: feat.name,
          count: choice.count,
          options: getFeatChoiceOptions(choice),
          note: choice.note,
        });
      }
    }
    return { groups, spells };
  }, [details, level, selectedOptions]);

  React.useEffect(() => {
    if (nested.spells.length === 0) { setSpellOptions({}); return; }
    let alive = true;
    loadSpellChoiceOptions(nested.spells, (query) => api<Array<{ id: string; name: string }>>(query), { forceIncludeText: true })
      .then((options) => { if (alive) setSpellOptions(options); })
      .catch(() => { if (alive) setSpellOptions({}); });
    return () => { alive = false; };
  }, [nested.spells]);

  const valid = details.length === featIds.length
    && nested.groups.every((choice) => (selectedOptions[choice.key] ?? []).length === choice.count)
    && nested.spells.every((choice) => (selectedOptions[choice.key] ?? []).length === choice.count);

  return { featIds, details, groups: nested.groups, spellChoices: nested.spells, spellOptions, valid };
}
