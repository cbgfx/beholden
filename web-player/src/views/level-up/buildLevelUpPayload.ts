import { readClassSpellSelection } from "@/domain/character/classSpellSelections";
import { levelUpConstitutionHp } from "@beholden/shared/domain/progressionHp";
import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import { carryPreparedSpells } from "@beholden/shared/domain/spellPreparation";
import { collectFeatTaggedEntries } from "@/views/character-creator/utils/FeatGrantUtils";
import { resolveFeatSpellEntries } from "@/views/character-creator/utils/FeatSpellcastingUtils";
import type { BuildLevelUpPayloadArgs } from "./LevelUpUtils";
import { appendMissingFeatureNotes } from "@/domain/character/featureNoteTemplates";
import type { PlayerNote } from "@/views/character/CharacterSheetTypes";
import { selectedInvocationFeatIds } from "@/domain/character/invocationFeatChoices";
import { tagAcquisitionLevelMap, dedupeTaggedEntriesByKey } from "@/domain/character/spellAcquisition";
import { applyExclusiveGroupReplacement } from "@/views/level-up/LevelUpExclusiveChoiceUtils";
import { reconcileProgressionOccurrences, type ProgressionReplacementEvent, type ProgressionSelectionOccurrence } from "@beholden/shared/domain/progressionOwnership";

// This builds `characterData.proficiencies` by patching deltas onto the character's EXISTING
// map, category by category -- deliberately not the same strategy as the character creator's
// `buildProficiencyMap` (CharacterCreatorProficiencyUtils.ts), which rebuilds the whole map from
// scratch every save. That's not an oversight: `buildProficiencyMap` needs `raceDetail`/`bgDetail`/
// `bgOriginFeatDetail`/`raceFeatDetail`/a full `classFeatDetails` record to do a from-scratch
// rebuild, and level-up has never loaded any of those -- race and background can never change
// after character creation, so there's nothing for level-up to re-derive there. Making level-up
// fetch that data just to reuse the creator's rebuild strategy would add real complexity (new
// compendium fetches, slower saves) to remove a duplication problem, not fix one. The two
// strategies share their low-level dedup primitive (`dedupeTaggedEntriesByKey`, used by both this
// file's `mergeTaggedEntries` and the creator's `dedupeTaggedItems`) and are tested per-category
// below so a fix to one path's category logic doesn't silently leave the other one wrong.
export function buildLevelUpPayload(args: BuildLevelUpPayloadArgs): Record<string, unknown> {
  const {
    char, nextLevel, hpGain, featHpBonus, subclass, chosenCantrips, chosenSpells, chosenInvocations,
    chosenExpertise, chosenFeatOptions, invocationFeatChoices = [], allInvocationFeatChoices = invocationFeatChoices, chosenFeatureChoices, expertiseChoices, expertiseReplacementChoices = [],
    fightingStyleReplacementChoice = null, pactBoonReplacementChoice = null,
    chosenFeatDetail, featSourceLabel,
    featSpellChoiceOptions = {},
    newFeatures, classDetailName, selectedCantripEntries, selectedSpellEntries, selectedInvocationEntries,
    selectedClassFeatureSpellEntries = [],
    selectedFeatureProficiencyEntries = {},
    selectedInvocationSpellEntries = [],
    selectedManeuverEntries = [],
    selectedMetamagicEntries = [],
    selectedInfusionEntries = [],
    selectedPlanEntries = [],
    baseScores, asiMode, asiStats, featAbilityBonuses,
  } = args;
  const targetClassLevel = args.nextClassLevel ?? nextLevel;
  const targetClassEntryId = args.targetClassEntryId ?? char.characterData?.classes?.[0]?.id
    ?? `class_${String(char.className ?? "").trim().toLowerCase().replace(/\s+/g, "_") || "primary"}`;

  // hpMax stores base HP. Deterministic feat bonuses are derived from the
  // current compendium definition when the sheet loads.
  const constitutionBefore = baseScores.con ?? 10;
  const constitutionChange = levelUpConstitutionHp({ constitution: constitutionBefore, nextLevel, mode: asiMode, asi: asiStats, feat: featAbilityBonuses });
  const newHpMax = char.hpMax + hpGain + constitutionChange.adjustment;
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
  const existingMetamagicEntries = _arr(proficiencies?.metamagic);
  const existingInfusionEntries = _arr(proficiencies?.infusions);
  const existingPlanEntries = _arr(proficiencies?.plans);
  const classSource = classDetailName ?? char.className;
  const multiclassProficiencies = args.isAddingClass ? args.multiclassProficiencies : undefined;
  const multiclassTagged = (names: string[] | undefined) => (names ?? []).map((name) => ({ name, source: classSource, sourceKey: `class:${targetClassEntryId}` }));
  const selectedExpertiseEntries = expertiseChoices.flatMap((choice) =>
    (chosenExpertise[choice.key] ?? []).map((name) => ({ name, source: choice.source }))
  );
  const replacedExpertiseNames = new Set(
    expertiseReplacementChoices
      .flatMap((choice) => chosenExpertise[`${choice.key}:target`] ?? [])
      .map((name) => name.trim().toLowerCase())
  );
  const selectedExpertiseReplacementEntries = expertiseReplacementChoices.flatMap((choice) =>
    (chosenExpertise[choice.key] ?? []).map((name) => ({ name, source: choice.source }))
  );
  const existingChosenOptionals = Array.isArray(char.characterData?.chosenOptionals) ? char.characterData.chosenOptionals : [];
  const nextChosenOptionals = [fightingStyleReplacementChoice, pactBoonReplacementChoice].reduce(
    (optionals, choice) => applyExclusiveGroupReplacement({
      chosenOptionals: optionals,
      choice,
      selectedOptionId: choice ? chosenFeatureChoices[choice.key]?.[0] ?? null : null,
    }),
    existingChosenOptionals,
  );
  const mergeTaggedEntries = <T extends { name?: string; source?: string }>(...groups: T[][]): T[] =>
    dedupeTaggedEntriesByKey(groups.flat(), (entry) => {
      const name = String(entry.name ?? "").trim().toLowerCase();
      if (!name) return "";
      return `${String(entry.source ?? "").trim().toLowerCase()}::${name}`;
    }, { onConflict: "keep-last" });

  // The "drop this category's prior grant from featSourceLabel" filter is the same one-liner
  // repeated across every proficiency category below -- named once so it reads as one idea.
  const dropFeatSource = <T extends { source?: string }>(entries: T[]): T[] =>
    entries.filter((entry) => entry.source !== featSourceLabel);

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
  const activeInvocationFeatChoiceKeys = new Set(invocationFeatChoices.map((choice) => choice.key));
  for (const choice of allInvocationFeatChoices) {
    if (!activeInvocationFeatChoiceKeys.has(choice.key)) delete nextChosenFeatOptions[choice.key];
  }
  const invocationGrantedFeatIds = selectedInvocationFeatIds(invocationFeatChoices, nextChosenFeatOptions);
  const previousInvocationGrantedFeatIds = selectedInvocationFeatIds(
    allInvocationFeatChoices,
    (char.characterData?.chosenFeatOptions ?? {}) as Record<string, string[]>,
  );
  const nextExtraFeatIds = Array.from(new Set([
    ...((char.characterData?.extraFeatIds ?? []) as string[]).filter((id) => !previousInvocationGrantedFeatIds.includes(id)),
    ...invocationGrantedFeatIds,
  ]));

  // Same preserve-or-stamp rule as spells/invocations: a Pact Boon/Fighting Style pick or
  // invocation-granted feat that already has a tag keeps it; only something new this level-up
  // gets stamped with the class level being leveled to.
  const existingAcquisitionLevels = (char.characterData?.acquisitionLevels ?? {}) as Record<string, number | null>;
  const nextAcquisitionLevels = {
    ...tagAcquisitionLevelMap(
      nextChosenOptionals.map((name) => `optional:${name}`),
      existingAcquisitionLevels,
      targetClassLevel,
    ),
    ...tagAcquisitionLevelMap(
      nextExtraFeatIds.map((id) => `extraFeat:${id}`),
      existingAcquisitionLevels,
      targetClassLevel,
    ),
  };
  const existingOccurrences = Array.isArray(char.characterData?.progressionSelectionOccurrences)
    ? char.characterData.progressionSelectionOccurrences as ProgressionSelectionOccurrence[] : [];
  const invocationOccurrences = reconcileProgressionOccurrences({
    existing: existingOccurrences, kind: "invocation", values: chosenInvocations,
    sourceKey: `class:${targetClassEntryId}:invocations`, classEntryId: targetClassEntryId,
    classLevel: targetClassLevel, characterLevel: nextLevel,
  });
  const nextOccurrences = reconcileProgressionOccurrences({
    existing: invocationOccurrences, kind: "optional", values: nextChosenOptionals,
    sourceKey: `class:${targetClassEntryId}:optionals`, classEntryId: targetClassEntryId,
    classLevel: targetClassLevel, characterLevel: nextLevel,
    preserveAcrossOwners: true,
  });
  const priorOccurrenceIds = new Set(existingOccurrences.map((entry) => entry.occurrenceId));
  const addedOccurrences = nextOccurrences.filter((entry) => !priorOccurrenceIds.has(entry.occurrenceId));
  const retainedOccurrenceIds = new Set(nextOccurrences.map((entry) => entry.occurrenceId));
  const removedOccurrences = existingOccurrences.filter((entry) =>
    entry.classEntryId === targetClassEntryId && !retainedOccurrenceIds.has(entry.occurrenceId));
  const pairedAdded = new Set<string>();
  const replacementEvents: ProgressionReplacementEvent[] = [
    ...(Array.isArray(char.characterData?.progressionReplacementEvents) ? char.characterData.progressionReplacementEvents as ProgressionReplacementEvent[] : []),
    ...removedOccurrences.flatMap((removed) => {
      const added = addedOccurrences.find((candidate) => candidate.kind === removed.kind && !pairedAdded.has(candidate.occurrenceId));
      if (added) pairedAdded.add(added.occurrenceId);
      return added ? [{
        eventId: `replace:${targetClassEntryId}:${targetClassLevel}:${removed.occurrenceId}:${added.occurrenceId}`,
        kind: added.kind, sourceKey: added.sourceKey, removedOccurrenceId: removed.occurrenceId,
        addedOccurrenceId: added.occurrenceId, classEntryId: targetClassEntryId,
        classLevel: targetClassLevel, characterLevel: nextLevel,
      }] : [];
    }),
  ];
  const existingLevelUpFeats = Array.isArray(char.characterData?.chosenLevelUpFeats) ? char.characterData?.chosenLevelUpFeats : [];
  const asiAbilityBonuses = Object.fromEntries(
    Object.entries(asiStats).filter(([, value]) => Number(value) > 0),
  );
  const featGrantedAbilityBonuses = Object.fromEntries(
    Object.entries(featAbilityBonuses).filter(([, value]) => Number(value) > 0),
  );
  const nextLevelUpEntry =
    asiMode === "asi"
      ? { level: targetClassLevel, classEntryId: targetClassEntryId, classLevel: targetClassLevel, characterLevel: nextLevel, sourceFeatureId: `class:${targetClassEntryId}:asi:${targetClassLevel}`, type: "asi" as const, abilityBonuses: asiAbilityBonuses }
      : asiMode === "feat" && chosenFeatDetail
        ? { level: targetClassLevel, classEntryId: targetClassEntryId, classLevel: targetClassLevel, characterLevel: nextLevel, sourceFeatureId: `class:${targetClassEntryId}:asi:${targetClassLevel}`, type: "feat" as const, featId: chosenFeatDetail.id, abilityBonuses: featGrantedAbilityBonuses, hitPointMaxBonusPerLevel: nextLevel > 0 ? Math.max(0, Math.trunc(featHpBonus / nextLevel)) : 0 }
        : null;
  const nextLevelUpFeats = nextLevelUpEntry
    ? [
        ...existingLevelUpFeats.filter((entry) =>
          entry.classEntryId
            ? !(entry.classEntryId === targetClassEntryId && Number(entry.classLevel ?? entry.level) === targetClassLevel)
            : Number(entry?.level) !== nextLevel
        ),
        nextLevelUpEntry,
      ]
    : existingLevelUpFeats;
  const existingHpEffects = Array.isArray(char.characterData?.progressionHpEffects) ? char.characterData.progressionHpEffects : [];
  const hpEffectsWithoutTargetChoice = existingHpEffects.filter((effect: any) => !(effect.classEntryId === targetClassEntryId && Number(effect.classLevel) === targetClassLevel && String(effect.sourceKey ?? "").startsWith("level-feat:")));
  const nextHpEffects = chosenFeatDetail && featHpBonus > 0
    ? [...hpEffectsWithoutTargetChoice, { sourceKey: `level-feat:${targetClassEntryId}:${targetClassLevel}:${chosenFeatDetail.id}`, multiplier: Math.max(0, Math.trunc(featHpBonus / nextLevel)), classEntryId: targetClassEntryId, classLevel: targetClassLevel }]
    : hpEffectsWithoutTargetChoice;
  const existingFeatureNames = Array.isArray(char.characterData?.selectedFeatureNames) ? char.characterData.selectedFeatureNames : [];
  const featureNames = new Set(existingFeatureNames);
  for (const feature of newFeatures) {
    featureNames.add(feature.name);
  }
  if (chosenFeatDetail) {
    featureNames.add(chosenFeatDetail.name);
  }
  const newNoteTemplates = newFeatures.map((feature) => feature.noteTemplate).filter(Boolean);
  const nextPlayerNotes = newNoteTemplates.length > 0
    ? appendMissingFeatureNotes(char.characterData?.playerNotesList as PlayerNote[] | undefined, newNoteTemplates)
    : null;

  const primaryClassEntryId = char.characterData?.classes?.[0]?.id ?? targetClassEntryId;
  const previousTargetSelection = readClassSpellSelection(char.characterData, targetClassEntryId);
  const classSpellSelections = {
    [primaryClassEntryId]: readClassSpellSelection(char.characterData, primaryClassEntryId),
    ...char.characterData?.classSpellSelections,
    [targetClassEntryId]: {
      ...previousTargetSelection,
      chosenCantrips, chosenSpells, chosenInvocations,
    },
  };
  // Preparation is a flag on each spell's entry: the rebuilt list keeps every spell prepared that
  // was, and a class that prepares exactly the spells it learns gets this level's picks prepared.
  const newlyPreparedKeys = !args.usesFlexiblePreparedSpellsModel && classDetailName && chosenSpells.length > 0 && !classDetailName.toLowerCase().includes("warlock")
    ? selectedSpellEntries.map((entry) => normalizeSpellTrackingKey(entry.name))
    : [];
  // Deliberately not spreading `...char.characterData` here: it's a snapshot fetched once when
  // the level-up screen opened, and any field we don't explicitly list below should come from
  // whatever's currently on the server (the PUT handler merges this patch onto a fresh read),
  // not from a stale copy that could clobber concurrent edits (inventory, notes, etc.).
  const nextCharacterData = {
    progressionSchemaVersion: 3,
    // Known facts from this transition only; do not invent earlier die rolls.
    hpProgressionHistory: [
      ...(Array.isArray(char.characterData?.hpProgressionHistory) ? char.characterData.hpProgressionHistory : []),
      {
        characterLevelBefore: nextLevel - 1, characterLevelAfter: nextLevel,
        classEntryId: targetClassEntryId, classLevelAfter: targetClassLevel,
        baseHpMaxBefore: char.hpMax, baseHpMaxAfter: newHpMax, levelHpGain: hpGain,
        hpMethod: args.hpMethod ?? null,
        hitDieResult: args.hpMethod === "roll" || args.hpMethod === "manual" ? args.hitDieResult ?? null : null,
        constitutionBefore, constitutionAfter: constitutionChange.constitutionAfter,
        constitutionHpAdjustment: constitutionChange.adjustment,
      },
    ],
    classes: Array.isArray(char.characterData?.classes) && char.characterData.classes.length > 0
      ? [
          ...char.characterData.classes.map((entry) =>
          entry.id === targetClassEntryId
            ? {
                ...entry,
                level: targetClassLevel,
                subclass: subclass || null,
              }
            : entry
          ),
          ...(args.isAddingClass ? [{
            id: targetClassEntryId,
            classId: args.targetClassId ?? null,
            className: classDetailName ?? "Class",
            level: 1,
            subclass: null,
          }] : []),
        ]
      : [{
          id: `class_${String(char.className ?? "").trim().toLowerCase().replace(/\s+/g, "_") || "primary"}`,
          classId: null,
          className: char.className,
          level: targetClassLevel,
          subclass: subclass || null,
        }],
    chosenLevelUpFeats: nextLevelUpFeats,
    classSpellSelections,
    extraFeatIds: nextExtraFeatIds,
    acquisitionLevels: nextAcquisitionLevels,
    progressionSelectionOccurrences: nextOccurrences,
    progressionReplacementEvents: replacementEvents,
    progressionHpEffects: nextHpEffects,
    chosenFeatOptions: nextChosenFeatOptions,
    chosenFeatureChoices: {
      ...((char.characterData?.chosenFeatureChoices ?? {}) as Record<string, string[]>),
      ...chosenFeatureChoices,
    },
    chosenOptionals: nextChosenOptionals,
    selectedFeatureNames: Array.from(featureNames),
    ...(nextPlayerNotes ? { playerNotesList: nextPlayerNotes } : {}),
    proficiencies: {
      ...(proficiencies ?? {}),
      skills: [
        ...dropFeatSource(existingSkillEntries),
        ...multiclassTagged(multiclassProficiencies?.skills),
        ...(selectedFeatEntries?.skills ?? []),
        ...(selectedFeatureProficiencyEntries.skills ?? []),
      ],
      tools: [
        ...dropFeatSource(existingToolEntries),
        ...multiclassTagged(multiclassProficiencies?.tools),
        ...(selectedFeatEntries?.tools ?? []),
        ...(selectedFeatureProficiencyEntries.tools ?? []),
      ],
      languages: [
        ...dropFeatSource(existingLanguageEntries),
        ...(selectedFeatEntries?.languages ?? []),
        ...(selectedFeatureProficiencyEntries.languages ?? []),
      ],
      armor: [
        ...dropFeatSource(existingArmorEntries),
        ...multiclassTagged(multiclassProficiencies?.armor),
        ...(selectedFeatEntries?.armor ?? []),
        ...(selectedFeatureProficiencyEntries.armor ?? []),
      ],
      weapons: [
        ...dropFeatSource(existingWeaponEntries),
        ...multiclassTagged(multiclassProficiencies?.weapons),
        ...(selectedFeatEntries?.weapons ?? []),
        ...(selectedFeatureProficiencyEntries.weapons ?? []),
      ],
      saves: [
        ...dropFeatSource(existingSaveEntries),
        ...(selectedFeatEntries?.saves ?? []),
        ...(selectedFeatureProficiencyEntries.saves ?? []),
      ],
      spells: carryPreparedSpells([
        ...mergeTaggedEntries(
          // Class spell proficiencies are the character's accumulated spellbook/known-spell
          // history, not merely the currently prepared selection. Removing the class source
          // here caused Wizards to forget every unprepared spell on level-up.
          dropFeatSource(existingSpells),
          selectedCantripEntries.map((entry) => ({ ...entry, classEntryId: targetClassEntryId, sourceKey: `class:${targetClassEntryId}` })),
          selectedSpellEntries.map((entry) => ({ ...entry, classEntryId: targetClassEntryId, sourceKey: `class:${targetClassEntryId}` })),
          selectedClassFeatureSpellEntries,
          selectedInvocationSpellEntries,
          selectedFeatSpellEntries,
        ),
      ], existingSpells, newlyPreparedKeys),
      invocations: [
        ...existingInvocations.filter((entry) => entry.source !== classSource),
        ...selectedInvocationEntries.map((entry) => ({ ...entry, classEntryId: targetClassEntryId, sourceKey: `class:${targetClassEntryId}` })),
      ],
      expertise: [
        ...existingExpertiseEntries
          .filter((entry) => !expertiseChoices.some((choice) => choice.source === entry.source) && entry.source !== featSourceLabel)
          .filter((entry) => !replacedExpertiseNames.has(String(entry.name ?? "").trim().toLowerCase())),
        ...selectedExpertiseEntries,
        ...selectedExpertiseReplacementEntries,
        ...(selectedFeatEntries?.expertise ?? []),
      ],
      maneuvers: selectedManeuverEntries.length > 0 || (selectedFeatEntries?.maneuvers.length ?? 0) > 0
        ? [
            ...existingManeuverEntries.filter((entry) => !selectedManeuverEntries.some((selected) => selected.sourceKey && entry.sourceKey === selected.sourceKey)),
            ...selectedManeuverEntries,
            ...(selectedFeatEntries?.maneuvers ?? []),
          ]
        : existingManeuverEntries,
      metamagic: selectedMetamagicEntries.length > 0
        ? [
            ...existingMetamagicEntries.filter((entry) => !selectedMetamagicEntries.some((selected) => selected.sourceKey && entry.sourceKey === selected.sourceKey)),
            ...selectedMetamagicEntries,
          ]
        : existingMetamagicEntries,
      infusions: selectedInfusionEntries.length > 0
        ? [
            ...existingInfusionEntries.filter((entry) => !selectedInfusionEntries.some((selected) => selected.sourceKey && entry.sourceKey === selected.sourceKey)),
            ...selectedInfusionEntries,
          ]
        : existingInfusionEntries,
      plans: selectedPlanEntries.length > 0
        ? [
            ...existingPlanEntries.filter((entry) => !selectedPlanEntries.some((selected) => selected.sourceKey && entry.sourceKey === selected.sourceKey)),
            ...selectedPlanEntries,
          ]
        : existingPlanEntries,
    },
  };

  const payload: Record<string, unknown> = {
    progressionClassEntryId: targetClassEntryId,
    expectedCharacterRevision: char.updatedAt,
    level: nextLevel,
    hpMax: newHpMax,
    hpCurrent: char.hpCurrent + hpGain + constitutionChange.adjustment + featHpBonus,
    characterData: nextCharacterData,
  };

  if (asiMode === "asi") {
    for (const [k, v] of Object.entries(asiStats)) {
      const scoreKey = `${k}Score`;
      payload[scoreKey] = Math.max(baseScores[k] ?? 10, Math.min(20, (baseScores[k] ?? 10) + v));
    }
  } else if (asiMode === "feat") {
    for (const [k, v] of Object.entries(featAbilityBonuses)) {
      const scoreKey = `${k}Score`;
      payload[scoreKey] = Math.max(baseScores[k] ?? 10, Math.min(20, (baseScores[k] ?? 10) + v));
    }
  }

  return payload;
}
