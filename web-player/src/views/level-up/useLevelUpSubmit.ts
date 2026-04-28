import React from "react";
import { type NavigateFunction } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { resolveSelectedSpellOptionEntries } from "@/views/character-creator/utils/SpellChoiceUtils";
import { buildLevelUpPayload, type BuildLevelUpPayloadArgs } from "@/views/level-up/LevelUpUtils";
import type {
  AsiMode,
  LevelUpCharacter as Character,
  LevelUpFeatDetail as FeatDetail,
  LevelUpResolvedSpellChoiceEntry,
  LevelUpSpellSummary as SpellSummary,
} from "@/views/level-up/LevelUpTypes";

type NamedEntry = { id: string; name: string };
type ChoiceWithKey = { key: string; title: string; sourceLabel?: string | null };
type FeatureProficiencyChoice = { key: string; category: "skill" | "tool" | "language" | "armor" | "weapon" | "saving_throw"; sourceLabel: string };
type ManeuverChoiceEntry = {
  definition: { sourceLabel: string; sourceKey?: string | null };
  chosenEntries: Array<{ id: string; name: string }>;
  selectedAbility: "str" | "dex" | "con" | "int" | "wis" | "cha" | null;
};
type PlanChoiceEntry = {
  definition: { key: string; sourceLabel: string; sourceKey?: string | null };
  chosen: string[];
};

type GrowthOptionEntry = { id: string; name: string };

export function useLevelUpSubmit(args: {
  char: Character | null;
  canConfirm: boolean;
  extraFeatSpellSelectionsValid: boolean;
  navigate: NavigateFunction;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  nextLevel: number;
  hpGain: number | null;
  featHpBonus: number;
  subclass: string;
  chosenCantrips: string[];
  chosenSpells: string[];
  chosenInvocations: string[];
  chosenExpertise: Record<string, string[]>;
  chosenFeatOptions: Record<string, string[]>;
  chosenFeatureChoices: Record<string, string[]>;
  expertiseChoices: Array<{ key: string; source: string }>;
  featChoiceEntries: BuildLevelUpPayloadArgs["featChoiceEntries"];
  chosenFeatDetail: FeatDetail | null;
  featSourceLabel: string;
  featSpellChoiceOptions: Record<string, Array<{ id: string; name: string }>>;
  newFeatures: Array<{ name: string; text?: string }>;
  classDetailName?: string | null;
  classCantrips: SpellSummary[];
  classSpells: SpellSummary[];
  classInvocations: SpellSummary[];
  effectiveChosenCantrips: string[];
  effectiveChosenSpells: string[];
  effectiveChosenInvocations: string[];
  classFeatureResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  classFeatureSpellChoiceOptions: Record<string, Array<{ id: string; name: string }>>;
  classFeatureProficiencyChoices: FeatureProficiencyChoice[];
  invocationResolvedSpellChoices: LevelUpResolvedSpellChoiceEntry[];
  invocationSpellChoiceOptions: Record<string, Array<{ id: string; name: string }>>;
  maneuverChoiceEntries: ManeuverChoiceEntry[];
  planChoiceEntries: PlanChoiceEntry[];
  growthOptionEntriesByKey: Record<string, GrowthOptionEntry[]>;
  baseScores: Record<string, number>;
  asiMode: AsiMode;
  asiStats: Record<string, number>;
  featAbilityBonuses: Record<string, number>;
}) {
  const [saving, setSaving] = React.useState(false);

  const confirm = React.useCallback(async () => {
    const {
      char,
      canConfirm,
      extraFeatSpellSelectionsValid,
      classCantrips,
      classSpells,
      classInvocations,
      effectiveChosenCantrips,
      effectiveChosenSpells,
      effectiveChosenInvocations,
      classDetailName,
      classFeatureResolvedSpellChoices,
      chosenFeatOptions,
      classFeatureSpellChoiceOptions,
      classFeatureProficiencyChoices,
      chosenFeatureChoices,
      invocationResolvedSpellChoices,
      invocationSpellChoiceOptions,
      maneuverChoiceEntries,
      planChoiceEntries,
      growthOptionEntriesByKey,
      nextLevel,
      hpGain,
      featHpBonus,
      subclass,
      chosenExpertise,
      expertiseChoices,
      featChoiceEntries,
      chosenFeatDetail,
      featSourceLabel,
      featSpellChoiceOptions,
      newFeatures,
      baseScores,
      asiMode,
      asiStats,
      featAbilityBonuses,
      navigate,
      setError,
    } = args;

    if (!char || !canConfirm || !extraFeatSpellSelectionsValid) return;

    setSaving(true);
    try {
      const selectedCantripEntries = classCantrips
        .filter((spell) => effectiveChosenCantrips.includes(spell.id))
        .map((spell) => ({ id: spell.id, name: spell.name, source: classDetailName ?? char.className }));

      const selectedSpellEntries = classSpells
        .filter((spell) => effectiveChosenSpells.includes(spell.id))
        .map((spell) => ({ id: spell.id, name: spell.name, source: classDetailName ?? char.className }));

      const selectedClassFeatureSpellEntries = classFeatureResolvedSpellChoices.flatMap((choice) => {
        const selected = resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          classFeatureSpellChoiceOptions[choice.key] ?? [],
        );
        return selected.map((spell) => ({ id: String(spell.id), name: spell.name, source: choice.sourceLabel ?? choice.title }));
      });

      const selectedFeatureProficiencyEntries = classFeatureProficiencyChoices.reduce<Partial<Record<"skills" | "tools" | "languages" | "armor" | "weapons" | "saves", Array<{ name: string; source: string }>>>>((acc, choice) => {
        const selected = (chosenFeatureChoices[choice.key] ?? []).map((name) => ({ name, source: choice.sourceLabel }));
        if (selected.length === 0) return acc;
        if (choice.category === "skill") acc.skills = [...(acc.skills ?? []), ...selected];
        if (choice.category === "tool") acc.tools = [...(acc.tools ?? []), ...selected];
        if (choice.category === "language") acc.languages = [...(acc.languages ?? []), ...selected];
        return acc;
      }, {});

      const selectedInvocationSpellEntries = invocationResolvedSpellChoices.flatMap((choice) => {
        const selected = resolveSelectedSpellOptionEntries(
          chosenFeatOptions[choice.key] ?? [],
          invocationSpellChoiceOptions[choice.key] ?? [],
        );
        return selected.map((spell) => ({ id: String(spell.id), name: spell.name, source: choice.sourceLabel ?? choice.title }));
      });

      const selectedInvocationEntries = classInvocations
        .filter((spell) => effectiveChosenInvocations.includes(spell.id))
        .map((spell) => ({ id: spell.id, name: spell.name, source: classDetailName ?? char.className }));

      const selectedManeuverEntries = maneuverChoiceEntries.flatMap((entry) =>
        entry.chosenEntries.map((spell) => ({
          id: String(spell.id),
          name: spell.name,
          source: entry.definition.sourceLabel,
          ability: entry.selectedAbility,
          sourceKey: entry.definition.sourceKey,
        }))
      );

      const selectedPlanEntries = planChoiceEntries.flatMap((entry) => {
        const byId = new Map((growthOptionEntriesByKey[entry.definition.key] ?? []).map((item) => [String(item.id), item]));
        return entry.chosen
          .map((id) => byId.get(String(id)))
          .filter((item): item is NamedEntry => Boolean(item))
          .map((item) => ({
            id: String(item.id),
            name: item.name,
            source: entry.definition.sourceLabel,
            sourceKey: entry.definition.sourceKey,
          }));
      });

      const payload = buildLevelUpPayload({
        char,
        nextLevel,
        hpGain: hpGain ?? 0,
        featHpBonus,
        subclass,
        chosenCantrips: effectiveChosenCantrips,
        chosenSpells: effectiveChosenSpells,
        chosenInvocations: effectiveChosenInvocations,
        chosenExpertise,
        chosenFeatOptions,
        chosenFeatureChoices,
        expertiseChoices,
        featChoiceEntries,
        chosenFeatDetail,
        featSourceLabel,
        featSpellChoiceOptions,
        newFeatures,
        classDetailName,
        selectedCantripEntries,
        selectedSpellEntries,
        selectedClassFeatureSpellEntries,
        selectedFeatureProficiencyEntries,
        selectedInvocationSpellEntries,
        selectedInvocationEntries,
        selectedManeuverEntries,
        selectedPlanEntries,
        baseScores,
        asiMode,
        asiStats,
        featAbilityBonuses,
      });

      await api(`/api/me/characters/${char.id}`, jsonInit("PUT", payload));
      navigate(`/characters/${char.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }, [args]);

  return { saving, confirm };
}
