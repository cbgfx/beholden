import type { ClassSpellSelection } from "@/domain/character/classSpellSelections";
import { requirementBlocks, validAsiAllocation, type ProgressionRequirement } from "@beholden/shared/domain/progressionRequirements";
import React from "react";
import type { UiTranslator } from "@beholden/shared/i18n";
import { type NavigateFunction } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { createMyCharacter } from "@/services/actorApi";
import { buildCreatorSubmissionBody } from "@/views/character-creator/creatorSubmission";
import { collectProficiencyChoiceEffectsFromEffects } from "@/domain/character/parseFeatureEffects";
import { useUiTranslation } from "@beholden/shared/i18n";
import {
  getSubclassLevel,
  getSubclassList,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  getWeaponMasteryChoice,
  parseAppliedClassFeatureEffects,
} from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";
import type {
  BgDetail,
  ClassDetail,
  ClassSummary,
  LevelUpFeatDetail,
  LevelUpFeatSelection,
  RaceDetail,
  SpellSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import type {
  ParsedFeatDetailLike as BackgroundFeat,
} from "@/views/character-creator/utils/FeatChoiceTypes";
import type { FormState } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type { ParsedFeatChoiceLike as ParsedFeatChoice } from "@/views/character-creator/utils/FeatChoiceTypes";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import type { ProgressionReplacementEvent, ProgressionSelectionOccurrence } from "@beholden/shared/domain/progressionOwnership";

type NamedOption = { id: string; name: string };

function creationTokenForDraft(isEditing: boolean): string {
  if (isEditing) return "";
  const generated = globalThis.crypto?.randomUUID?.() ?? `character-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (typeof window === "undefined") return generated;
  const url = new URL(window.location.href);
  const existing = url.searchParams.get("creationToken");
  if (existing && existing.length >= 16 && existing.length <= 128) return existing;
  url.searchParams.set("creationToken", generated);
  window.history.replaceState(window.history.state, "", url);
  return generated;
}

function levelUpFeatLevels(classDetail: ClassDetail | null, level: number): number[] {
  return Array.from(new Set((classDetail?.autolevels ?? [])
    .filter((autolevel) => autolevel.scoreImprovement && autolevel.level != null && autolevel.level <= level)
    .map((autolevel) => autolevel.level)))
    .sort((a, b) => a - b);
}

function hasCompleteLevelUpChoice(form: FormState, level: number): boolean {
  const entry = form.chosenLevelUpFeats.find((candidate) => candidate.level === level);
  if (!entry?.type) return false;
  if (entry.type === "feat") return Boolean(entry.featId);
  if (entry.type === "asi") {
    return validAsiAllocation(entry.abilityBonuses ?? {});
  }
  return false;
}

function findCreatorSubmissionProblem(args: {
  form: FormState;
  classDetail: ClassDetail | null;
  raceDetail: RaceDetail | null;
  bgDetail: BgDetail | null;
  t: UiTranslator;
}): string | null {
  const { form, classDetail, raceDetail, bgDetail, t } = args;
  if (!form.ruleset) return t("Choose a ruleset before saving.");
  const age = Number(String(form.age ?? "").trim());
  if (!Number.isInteger(age) || age <= 0) return t("Enter a valid age before saving.");
  if (form.gender !== "male" && form.gender !== "female") return t("Choose a gender before saving.");
  // These details drive derived proficiencies (armor/weapons/skills/etc). They're fetched
  // asynchronously from `form.classId`/`raceId`/`bgId`, so submitting before they resolve
  // would silently save an incomplete proficiency map — block until they're ready.
  if (form.classId && !classDetail) return t("Class details are still loading — please wait a moment and try again.");
  if (form.raceId && !raceDetail) return t("Species details are still loading — please wait a moment and try again.");
  if (form.bgId && !bgDetail) return t("Background details are still loading — please wait a moment and try again.");

  const subclassLevel = getSubclassLevel(classDetail);
  if (classDetail && subclassLevel != null && form.level >= subclassLevel && getSubclassList(classDetail).length > 0 && !form.subclass) {
    return t("Choose a subclass before saving.");
  }

  const missingLevelUpLevel = levelUpFeatLevels(classDetail, form.level).find((level) => !hasCompleteLevelUpChoice(form, level));
  if (missingLevelUpLevel != null) return t("Complete the level {{level}} feat or Ability Score Improvement before saving.", { level: missingLevelUpLevel });

  const masteryChoice = getWeaponMasteryChoice(classDetail, form.level);
  if (masteryChoice && form.chosenWeaponMasteries.length < masteryChoice.count) {
    return t("Choose {{count}} weapon masteries before saving.", { count: masteryChoice.count });
  }

  const classFeatureEffects = parseAppliedClassFeatureEffects(classDetail, form.level, form.subclass, form.chosenOptionals);
  const incompleteFeatureChoice = collectProficiencyChoiceEffectsFromEffects(classFeatureEffects)
    .filter((choice) =>
      !choice.expertise
      && choice.choice?.count.kind === "fixed"
      && ["skill", "tool", "language", "selection"].includes(choice.choice?.optionCategory ?? "")
    )
    .find((choice) => (form.chosenFeatureChoices[`classfeature:${choice.choiceId ?? choice.id}`] ?? []).length < (choice.choice?.count.kind === "fixed" ? choice.choice.count.value : 0));
  if (incompleteFeatureChoice) return t("Complete the {{name}} choice before saving.", { name: incompleteFeatureChoice.source.name });

  return null;
}

export function useCharacterCreatorSubmit(args: {
  requirements: ProgressionRequirement[];
  form: FormState;
  classDetail: ClassDetail | null;
  selectedClassSummary: ClassSummary | null;
  raceDetail: RaceDetail | null;
  bgDetail: BgDetail | null;
  featDetailCache: Record<string, BackgroundFeat>;
  resolvedRaceFeatDetail: BackgroundFeat | null;
  resolvedBgOriginFeatDetail: BackgroundFeat | null;
  classFeatDetails: Record<string, BackgroundFeat>;
  levelUpFeatDetails: LevelUpFeatDetail[];
  featSpellChoiceOptions: Record<string, NamedOption[]>;
  growthOptionEntriesByKey: Record<string, NamedOption[]>;
  classCantrips: SpellSummary[];
  classSpells: SpellSummary[];
  classInvocations: SpellSummary[];
  isEditing: boolean;
  fallbackClassName?: string | null;
  fallbackHitDie?: number | null;
  fallbackSpecies?: string | null;
  existingHpCurrent?: number | null;
  existingHpMax?: number | null;
  existingHpProgressionHistory?: unknown[];
  existingCharacterRevision?: number | null;
  existingClassSpellSelections?: Record<string, ClassSpellSelection>;
  existingExtraFeatIds: string[];
  existingInvocationFeatIds: string[];
  existingSpells?: Array<{ id?: string; name?: string; level?: number | null; classEntryId?: string | null; prepared?: boolean }>;
  existingInvocations?: Array<{ id?: string; level?: number | null }>;
  existingAcquisitionLevels?: Record<string, number | null>;
  preservedLevelUpFeats?: LevelUpFeatSelection[];
  preservedLevelUpFeatOptions?: Record<string, string[]>;
  existingClasses?: Array<{ id?: string; classId?: string | null; className?: string | null; level?: number; subclass?: string | null }>;
  existingSelectedFeatureNames?: string[];
  existingProficiencies?: Partial<ProficiencyMap>;
  existingProgressionSelectionOccurrences?: ProgressionSelectionOccurrence[];
  existingProgressionReplacementEvents?: ProgressionReplacementEvent[];
  existingProgressionHpEffects?: Array<{ sourceKey: string; multiplier: number; classEntryId?: string; classLevel?: number }>;
  editId?: string;
  portraitFile: File | null;
  initialCampaignIdsRef: React.MutableRefObject<string[]>;
  classifyFeatSelection: (
    choice: ParsedFeatChoice<string>,
    value: string,
  ) => "skill" | "tool" | "language" | "armor" | "weapon" | "saving_throw" | "weapon_mastery" | "maneuver" | null;
  navigate: NavigateFunction;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const t = useUiTranslation("playerUi");
  const [busy, setBusy] = React.useState(false);
  const submitting = React.useRef(false);
  const savedCharacterRef = React.useRef<{ id: string; form: FormState; revision?: number } | null>(null);
  const completedFollowUpsRef = React.useRef<{ unassigned: Set<string>; assigned: boolean; portrait: boolean }>({
    unassigned: new Set(), assigned: false, portrait: false,
  });
  const creationTokenRef = React.useRef(creationTokenForDraft(args.isEditing));

  const handleSubmit = React.useCallback(async () => {
    if (submitting.current) return false;
    const blocker = args.requirements.find(requirementBlocks);
    if (blocker) { args.setError(blocker.message); return false; }
    const {
      form,
      classDetail,
      selectedClassSummary,
      raceDetail,
      bgDetail,
      featDetailCache,
      resolvedRaceFeatDetail,
      resolvedBgOriginFeatDetail,
      classFeatDetails,
      levelUpFeatDetails,
      featSpellChoiceOptions,
      growthOptionEntriesByKey,
      classCantrips,
      classSpells,
      classInvocations,
      isEditing,
      fallbackClassName,
      fallbackHitDie,
      fallbackSpecies,
      existingHpCurrent,
      existingExtraFeatIds,
      existingInvocationFeatIds,
      existingSpells,
      existingInvocations,
      existingAcquisitionLevels,
      existingClasses = [],
      existingSelectedFeatureNames,
      existingProficiencies,
      editId,
      portraitFile,
      initialCampaignIdsRef,
      classifyFeatSelection,
      navigate,
      setError,
    } = args;

    if (!form.characterName.trim()) {
      setError(t("Character name is required."));
      return false;
    }
    const submissionProblem = findCreatorSubmissionProblem({ form, classDetail, raceDetail, bgDetail, t });
    if (submissionProblem) {
      setError(submissionProblem);
      return false;
    }

    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const { body } = await buildCreatorSubmissionBody({
        api,
        form,
        classDetail,
        selectedClassSummary,
        raceDetail,
        bgDetail,
        featDetailCache,
        resolvedRaceFeatDetail,
        resolvedBgOriginFeatDetail,
        classFeatDetails,
        levelUpFeatDetails,
        featSpellChoiceOptions,
        growthOptionEntriesByKey,
        classCantrips,
        classSpells,
        classInvocations,
        isEditing,
        fallbackClassName,
        fallbackHitDie,
        fallbackSpecies,
        existingHpCurrent,
        existingHpMax: args.existingHpMax,
        existingHpProgressionHistory: args.existingHpProgressionHistory,
        existingCharacterRevision: args.existingCharacterRevision,
        existingClassSpellSelections: args.existingClassSpellSelections,
        existingExtraFeatIds,
        existingInvocationFeatIds,
        existingSpells,
        existingInvocations,
        existingAcquisitionLevels,
        preservedLevelUpFeats: args.preservedLevelUpFeats,
        preservedLevelUpFeatOptions: args.preservedLevelUpFeatOptions,
        existingClasses,
        existingSelectedFeatureNames,
        existingProficiencies,
        existingProgressionSelectionOccurrences: args.existingProgressionSelectionOccurrences,
        existingProgressionReplacementEvents: args.existingProgressionReplacementEvents,
        existingProgressionHpEffects: args.existingProgressionHpEffects,
        classifyFeatSelection,
      });

      const savedCharacter = savedCharacterRef.current;
      let charId = savedCharacter?.id ?? "";
      if (savedCharacter && savedCharacter.form !== form) {
        const saved = await api<{ updatedAt?: number }>(`/api/me/characters/${savedCharacter.id}`, jsonInit("PUT", {
          ...body,
          ...(savedCharacter.revision != null ? { expectedCharacterRevision: savedCharacter.revision } : {}),
        }));
        savedCharacterRef.current = { id: savedCharacter.id, form, revision: saved.updatedAt };
        completedFollowUpsRef.current = { unassigned: new Set(), assigned: false, portrait: false };
      } else if (savedCharacter) {
        // The character itself was already saved. Retry only assignments/image work that failed.
      } else if (isEditing && editId) {
        const saved = await api<{ updatedAt?: number }>(`/api/me/characters/${editId}`, jsonInit("PUT", body));
        charId = editId;
        savedCharacterRef.current = { id: charId, form, revision: saved.updatedAt };
        completedFollowUpsRef.current = { unassigned: new Set(), assigned: false, portrait: false };
      } else {
        const created = await createMyCharacter({ ...body, creationToken: creationTokenRef.current });
        charId = created.id;
        // Retain this immediately: campaign or image failure must never create a second character.
        savedCharacterRef.current = { id: charId, form, revision: created.updatedAt };
        completedFollowUpsRef.current = { unassigned: new Set(), assigned: false, portrait: false };
      }

      if (isEditing) {
        const removed = initialCampaignIdsRef.current.filter(
          (campaignId) => !form.campaignIds.includes(campaignId),
        );
        for (const campaignId of removed) {
          if (completedFollowUpsRef.current.unassigned.has(campaignId)) continue;
          await api(`/api/me/characters/${charId}/unassign`, jsonInit("POST", { campaignId }));
          completedFollowUpsRef.current.unassigned.add(campaignId);
        }
      }

      if (form.campaignIds.length > 0 && !completedFollowUpsRef.current.assigned) {
        await api(`/api/me/characters/${charId}/assign`, jsonInit("POST", { campaignIds: form.campaignIds }));
        completedFollowUpsRef.current.assigned = true;
      }

      if (portraitFile && !completedFollowUpsRef.current.portrait) {
        const fd = new FormData();
        fd.append("image", portraitFile);
        await api(`/api/me/characters/${charId}/image`, { method: "POST", body: fd });
        completedFollowUpsRef.current.portrait = true;
      }

      navigate(`/characters/${charId}`, { replace: true });
      return true;
    } catch (e: any) {
      setError(savedCharacterRef.current
        ? t("Character saved, but a campaign assignment or portrait update failed. Retry to finish those updates.", {
            defaultValue: `Character saved, but a campaign assignment or portrait update failed: ${e?.message ?? "Unknown error"}`,
          })
        : e?.message ?? t("Failed to save character."));
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }, [args, t]);

  return { busy, handleSubmit };
}
