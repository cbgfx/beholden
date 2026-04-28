import React from "react";
import { normalizeChoiceKey } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { reconcileSelectedSpellIds } from "@/views/level-up/LevelUpHelpers";
import type { LevelUpCharacter as Character, LevelUpSpellSummary as SpellSummary } from "@/views/level-up/LevelUpTypes";

export function useLevelUpSelectionSanitizers(args: {
  char: Character | null;
  classCantrips: SpellSummary[];
  classSpells: SpellSummary[];
  classInvocations: SpellSummary[];
  existingClassSpellNames: string[];
  existingClassInvocationNames: string[];
  preparedSpellProgressionGrantedKeys: Set<string>;
  cantripCount: number;
  maxSpellLevel: number;
  prepCount: number;
  allowedInvocationIds: Set<string>;
  invocCount: number;
  setChosenCantrips: React.Dispatch<React.SetStateAction<string[]>>;
  setChosenSpells: React.Dispatch<React.SetStateAction<string[]>>;
  setChosenInvocations: React.Dispatch<React.SetStateAction<string[]>>;
  expertiseChoices: Array<{ key: string; source: string; options?: string[] | null; count: number }>;
  proficientSkills: string[];
  existingExpertise: string[];
  setChosenExpertise: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}) {
  const {
    char,
    classCantrips,
    classSpells,
    classInvocations,
    existingClassSpellNames,
    existingClassInvocationNames,
    preparedSpellProgressionGrantedKeys,
    cantripCount,
    maxSpellLevel,
    prepCount,
    allowedInvocationIds,
    invocCount,
    setChosenCantrips,
    setChosenSpells,
    setChosenInvocations,
    expertiseChoices,
    proficientSkills,
    existingExpertise,
    setChosenExpertise,
  } = args;

  React.useEffect(() => {
    setChosenCantrips((prev) => {
      const next = reconcileSelectedSpellIds(prev, classCantrips, existingClassSpellNames).slice(0, cantripCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classCantrips, cantripCount, existingClassSpellNames, setChosenCantrips]);

  React.useEffect(() => {
    if (maxSpellLevel === 0) return;
    setChosenSpells((prev) => {
      const next = reconcileSelectedSpellIds(prev, classSpells, existingClassSpellNames)
        .filter((id) => {
          const spell = classSpells.find((entry) => entry.id === id);
          const spellLevel = Number(spell?.level ?? 0);
          return Boolean(spell) && spellLevel > 0 && spellLevel <= maxSpellLevel;
        })
        .slice(0, prepCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classSpells, existingClassSpellNames, maxSpellLevel, prepCount, setChosenSpells]);

  React.useEffect(() => {
    setChosenInvocations((prev) => {
      const next = reconcileSelectedSpellIds(prev, classInvocations, existingClassInvocationNames)
        .filter((id) => allowedInvocationIds.has(id))
        .slice(0, invocCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [allowedInvocationIds, classInvocations, existingClassInvocationNames, invocCount, setChosenInvocations]);

  React.useEffect(() => {
    if (expertiseChoices.length === 0) return;
    setChosenExpertise((prev) => {
      let changed = false;
      const next: Record<string, string[]> = { ...prev };
      const taken = new Set(existingExpertise.map((name) => normalizeChoiceKey(name)));
      const proficientSkillKeys = new Set(proficientSkills.map((skill) => normalizeChoiceKey(skill)));
      const existingExpertiseEntries = Array.isArray(char?.characterData?.proficiencies?.expertise)
        ? char.characterData.proficiencies.expertise
        : [];
      for (const choice of expertiseChoices) {
        const options = (choice.options ?? proficientSkills).filter((skill) => proficientSkillKeys.has(normalizeChoiceKey(skill)));
        const current = prev[choice.key] ?? [];
        const seededCurrent = current.length > 0
          ? current
          : existingExpertiseEntries
            .filter((entry) => typeof entry !== "string" && entry?.source === choice.source)
            .map((entry) => entry.name)
            .filter((skill) => options.some((option) => normalizeChoiceKey(option) === normalizeChoiceKey(skill)))
            .slice(0, choice.count);
        const filtered = current
          .filter((skill) => options.some((option) => normalizeChoiceKey(option) === normalizeChoiceKey(skill)))
          .filter((skill) => !taken.has(normalizeChoiceKey(skill)))
          .slice(0, choice.count);
        const finalSelection = filtered.length > 0 ? filtered : seededCurrent;
        finalSelection.forEach((skill) => taken.add(normalizeChoiceKey(skill)));
        if (finalSelection.length === 0) delete next[choice.key];
        else next[choice.key] = finalSelection;
        if (finalSelection.length !== current.length || finalSelection.some((skill, index) => skill !== current[index])) changed = true;
      }
      return changed ? next : prev;
    });
  }, [char?.characterData?.proficiencies?.expertise, expertiseChoices, proficientSkills, existingExpertise, setChosenExpertise]);
}
