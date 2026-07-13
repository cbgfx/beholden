import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import { collectFeatTaggedEntries } from "@/views/character-creator/utils/FeatGrantUtils";
import { resolveFeatSpellEntries } from "@/views/character-creator/utils/FeatSpellcastingUtils";
import type { BuildLevelUpPayloadArgs } from "./LevelUpUtils";

export function buildLevelUpPayload(args: BuildLevelUpPayloadArgs): Record<string, unknown> {
  const {
    char, nextLevel, hpGain, featHpBonus, subclass, chosenCantrips, chosenSpells, chosenInvocations,
    chosenExpertise, chosenFeatOptions, chosenFeatureChoices, expertiseChoices, chosenFeatDetail, featSourceLabel,
    featSpellChoiceOptions = {},
    newFeatures, classDetailName, selectedCantripEntries, selectedSpellEntries, selectedInvocationEntries,
    selectedClassFeatureSpellEntries = [],
    selectedFeatureProficiencyEntries = {},
    selectedInvocationSpellEntries = [],
    selectedManeuverEntries = [],
    selectedPlanEntries = [],
    baseScores, asiMode, asiStats, featAbilityBonuses,
  } = args;

  // hpMax stores base HP. Deterministic feat bonuses are derived from the
  // current compendium definition when the sheet loads.
  const newHpMax = char.hpMax + hpGain;
  const proficiencies = { ...(char.characterData?.proficiencies ?? {}) } as NonNullable<NonNullable<typeof char.characterData>["proficiencies"]>;
  const _arr = <T = { source: string; sourceKey?: string | null; name?: string }>(v: unknown): T[] => Array.isArray(v) ? v as T[] : [];
  const existingSpells = _arr(proficiencies?.spells);
  const existingInvocations = _arr(proficiencies?.invocations);
  const existingExpertiseEntries = _arr(proficiencies?.expertise);
  const existingSkillEntries = _arr(proficiencies?.skills);
  const existingToolEntries = _arr(proficiencies?.tools);
  const existingLanguageEntries = _arr(proficiencies?.languages);
  const existingArmorEntries = _arr(proficiencies?.armor);
  const existingWeaponEntries = _arr(proficiencies?.weapons);
  const existingSaveEntries = _arr(proficiencies?.saves);
  const existingManeuverEntries = _arr(proficiencies?.maneuvers);
  const existingPlanEntries = _arr(proficiencies?.plans);
  const classSource = classDetailName ?? char.className;
  const selectedExpertiseEntries = expertiseChoices.flatMap((choice) =>
    (chosenExpertise[choice.key] ?? []).map((name) => ({ name, source: choice.source }))
  );

  const selectedFeatEntries = chosenFeatDetail
    ? collectFeatTaggedEntries({
        feat: chosenFeatDetail,
        sourceLabel: featSourceLabel,
        selectedChoices: chosenFeatOptions,
        getChoiceKey: (choice) => `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`,
        resolveSelectedValue: (choice, key, value) =>
          choice.type === "spell"
            ? featSpellChoiceOptions[key]?.find((spell) => spell.id === value || spell.name === value)?.name ?? value
            : value,
      })
    : null;
  const selectedFeatSpellEntries = chosenFeatDetail
    ? resolveFeatSpellEntries({
        feat: chosenFeatDetail,
        sourceLabel: featSourceLabel,
        selectedChoices: chosenFeatOptions,
        getChoiceKey: (choice) => `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`,
        spellChoiceOptionsByKey: featSpellChoiceOptions,
      })
    : [];

  const nextChosenFeatOptions = {
    ...((char.characterData?.chosenFeatOptions ?? {}) as Record<string, string[]>),
    ...chosenExpertise,
    ...chosenFeatOptions,
  };
  const existingLevelUpFeats = Array.isArray(char.characterData?.chosenLevelUpFeats) ? char.characterData?.chosenLevelUpFeats : [];
  const asiAbilityBonuses = Object.fromEntries(
    Object.entries(asiStats).filter(([, value]) => Number(value) > 0),
  );
  const featGrantedAbilityBonuses = Object.fromEntries(
    Object.entries(featAbilityBonuses).filter(([, value]) => Number(value) > 0),
  );
  const nextLevelUpEntry =
    asiMode === "asi"
      ? { level: nextLevel, type: "asi" as const, abilityBonuses: asiAbilityBonuses }
      : asiMode === "feat" && chosenFeatDetail
        ? { level: nextLevel, type: "feat" as const, featId: chosenFeatDetail.id, abilityBonuses: featGrantedAbilityBonuses }
        : null;
  const nextLevelUpFeats = nextLevelUpEntry
    ? [
        ...existingLevelUpFeats.filter((entry) => Number(entry?.level) !== nextLevel),
        nextLevelUpEntry,
      ]
    : existingLevelUpFeats;
  const existingFeatureNames = Array.isArray(char.characterData?.selectedFeatureNames) ? char.characterData.selectedFeatureNames : [];
  const featureNames = new Set(existingFeatureNames);
  for (const feature of newFeatures) {
    featureNames.add(feature.name);
  }
  if (chosenFeatDetail) {
    featureNames.add(chosenFeatDetail.name);
  }

  // Deliberately not spreading `...char.characterData` here: it's a snapshot fetched once when
  // the level-up screen opened, and any field we don't explicitly list below should come from
  // whatever's currently on the server (the PUT handler merges this patch onto a fresh read),
  // not from a stale copy that could clobber concurrent edits (inventory, notes, etc.).
  const nextCharacterData = {
    classes: Array.isArray(char.characterData?.classes) && char.characterData.classes.length > 0
      ? char.characterData.classes.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                level: nextLevel,
                subclass: subclass || null,
              }
            : entry
        )
      : [{
          id: `class_${String(char.className ?? "").trim().toLowerCase().replace(/\s+/g, "_") || "primary"}`,
          classId: null,
          className: char.className,
          level: nextLevel,
          subclass: subclass || null,
        }],
    chosenLevelUpFeats: nextLevelUpFeats,
    chosenCantrips,
    chosenSpells,
    preparedSpells:
      classDetailName && chosenSpells.length > 0 && !String((char as { className?: string }).className ?? "").toLowerCase().includes("warlock")
        ? selectedSpellEntries.map((entry) => normalizeSpellTrackingKey(entry.name))
        : char.characterData?.preparedSpells,
    chosenInvocations,
    chosenFeatOptions: nextChosenFeatOptions,
    chosenFeatureChoices: {
      ...((char.characterData?.chosenFeatureChoices ?? {}) as Record<string, string[]>),
      ...chosenFeatureChoices,
    },
    selectedFeatureNames: Array.from(featureNames),
    proficiencies: {
      ...(proficiencies ?? {}),
      skills: [
        ...existingSkillEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.skills ?? []),
        ...(selectedFeatureProficiencyEntries.skills ?? []),
      ],
      tools: [
        ...existingToolEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.tools ?? []),
        ...(selectedFeatureProficiencyEntries.tools ?? []),
      ],
      languages: [
        ...existingLanguageEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.languages ?? []),
        ...(selectedFeatureProficiencyEntries.languages ?? []),
      ],
      armor: [
        ...existingArmorEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.armor ?? []),
        ...(selectedFeatureProficiencyEntries.armor ?? []),
      ],
      weapons: [
        ...existingWeaponEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.weapons ?? []),
        ...(selectedFeatureProficiencyEntries.weapons ?? []),
      ],
      saves: [
        ...existingSaveEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.saves ?? []),
        ...(selectedFeatureProficiencyEntries.saves ?? []),
      ],
      spells: [
        ...existingSpells.filter((entry) => entry.source !== classSource && entry.source !== featSourceLabel),
        ...selectedCantripEntries,
        ...selectedSpellEntries,
        ...selectedClassFeatureSpellEntries,
        ...selectedInvocationSpellEntries,
        ...selectedFeatSpellEntries,
      ],
      invocations: [
        ...existingInvocations.filter((entry) => entry.source !== classSource),
        ...selectedInvocationEntries,
      ],
      expertise: [
        ...existingExpertiseEntries.filter((entry) => !expertiseChoices.some((choice) => choice.source === entry.source) && entry.source !== featSourceLabel),
        ...selectedExpertiseEntries,
        ...(selectedFeatEntries?.expertise ?? []),
      ],
      maneuvers: selectedManeuverEntries.length > 0
        ? [
            ...existingManeuverEntries.filter((entry) => !selectedManeuverEntries.some((selected) => selected.sourceKey && entry.sourceKey === selected.sourceKey)),
            ...selectedManeuverEntries,
          ]
        : existingManeuverEntries,
      plans: selectedPlanEntries.length > 0
        ? [
            ...existingPlanEntries.filter((entry) => !selectedPlanEntries.some((selected) => selected.sourceKey && entry.sourceKey === selected.sourceKey)),
            ...selectedPlanEntries,
          ]
        : existingPlanEntries,
    },
  };

  const payload: Record<string, unknown> = {
    level: nextLevel,
    hpMax: newHpMax,
    hpCurrent: char.hpCurrent + hpGain + featHpBonus,
    characterData: nextCharacterData,
  };

  if (asiMode === "asi") {
    for (const [k, v] of Object.entries(asiStats)) {
      const scoreKey = `${k}Score`;
      payload[scoreKey] = Math.min(20, (baseScores[k] ?? 10) + v);
    }
  } else if (asiMode === "feat") {
    for (const [k, v] of Object.entries(featAbilityBonuses)) {
      const scoreKey = `${k}Score`;
      payload[scoreKey] = Math.min(20, (baseScores[k] ?? 10) + v);
    }
  }

  return payload;
}
