import React from "react";
import { type NavigateFunction } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { createMyCharacter } from "@/services/actorApi";
import { buildCreatorSubmissionBody } from "@/views/character-creator/creatorSubmission";
import { collectProficiencyChoiceEffectsFromEffects } from "@/domain/character/parseFeatureEffects";
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
  RaceDetail,
  SpellSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import type {
  ParsedFeatDetailLike as BackgroundFeat,
} from "@/views/character-creator/utils/FeatChoiceTypes";
import type { FormState } from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type { ParsedFeatChoiceLike as ParsedFeatChoice } from "@/views/character-creator/utils/FeatChoiceTypes";

type NamedOption = { id: string; name: string };

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
    const total = Object.values(entry.abilityBonuses ?? {}).reduce((sum, value) => sum + value, 0);
    return total === 2;
  }
  return false;
}

function findCreatorSubmissionProblem(args: { form: FormState; classDetail: ClassDetail | null }): string | null {
  const { form, classDetail } = args;
  const subclassLevel = getSubclassLevel(classDetail);
  if (classDetail && subclassLevel != null && form.level >= subclassLevel && getSubclassList(classDetail).length > 0 && !form.subclass) {
    return "Choose a subclass before saving.";
  }

  const missingLevelUpLevel = levelUpFeatLevels(classDetail, form.level).find((level) => !hasCompleteLevelUpChoice(form, level));
  if (missingLevelUpLevel != null) return `Complete the level ${missingLevelUpLevel} feat or Ability Score Improvement before saving.`;

  const masteryChoice = getWeaponMasteryChoice(classDetail, form.level);
  if (masteryChoice && form.chosenWeaponMasteries.length < masteryChoice.count) {
    return `Choose ${masteryChoice.count} weapon masteries before saving.`;
  }

  const classFeatureEffects = parseAppliedClassFeatureEffects(classDetail, form.level, form.subclass, form.chosenOptionals);
  const incompleteFeatureChoice = collectProficiencyChoiceEffectsFromEffects(classFeatureEffects)
    .filter((choice) =>
      !choice.expertise
      && choice.choice?.count.kind === "fixed"
      && ["skill", "tool", "language"].includes(choice.choice?.optionCategory ?? "")
    )
    .find((choice) => (form.chosenFeatureChoices[`classfeature:${choice.id}`] ?? []).length < (choice.choice?.count.kind === "fixed" ? choice.choice.count.value : 0));
  if (incompleteFeatureChoice) return `Complete the ${incompleteFeatureChoice.source.name} choice before saving.`;

  return null;
}

export function useCharacterCreatorSubmit(args: {
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
  editId?: string;
  portraitFile: File | null;
  initialCampaignIdsRef: React.MutableRefObject<string[]>;
  classifyFeatSelection: (
    choice: ParsedFeatChoice<string>,
    value: string,
  ) => "skill" | "tool" | "language" | "armor" | "weapon" | "saving_throw" | "weapon_mastery" | null;
  navigate: NavigateFunction;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = React.useCallback(async () => {
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
      editId,
      portraitFile,
      initialCampaignIdsRef,
      classifyFeatSelection,
      navigate,
      setError,
    } = args;

    if (!form.characterName.trim()) {
      setError("Character name is required.");
      return false;
    }
    const submissionProblem = findCreatorSubmissionProblem({ form, classDetail });
    if (submissionProblem) {
      setError(submissionProblem);
      return false;
    }

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
        classifyFeatSelection,
      });

      let charId: string;
      if (isEditing && editId) {
        await api(`/api/me/characters/${editId}`, jsonInit("PUT", body));
        charId = editId;
      } else {
        const created = await createMyCharacter(body);
        charId = created.id;
      }

      if (isEditing) {
        const removed = initialCampaignIdsRef.current.filter(
          (campaignId) => !form.campaignIds.includes(campaignId),
        );
        for (const campaignId of removed) {
          await api(`/api/me/characters/${charId}/unassign`, jsonInit("POST", { campaignId }));
        }
      }

      if (form.campaignIds.length > 0) {
        await api(`/api/me/characters/${charId}/assign`, jsonInit("POST", { campaignIds: form.campaignIds }));
      }

      if (portraitFile) {
        const fd = new FormData();
        fd.append("image", portraitFile);
        await api(`/api/me/characters/${charId}/image`, { method: "POST", body: fd });
      }

      navigate(`/characters/${charId}`, { replace: true });
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Failed to save character.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [args]);

  return { busy, handleSubmit };
}
