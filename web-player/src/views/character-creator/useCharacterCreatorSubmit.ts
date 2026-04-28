import React from "react";
import { type NavigateFunction } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { createMyCharacter } from "@/services/actorApi";
import { buildCreatorSubmissionBody } from "@/views/character-creator/creatorSubmission";
import type { Ruleset } from "@/lib/characterRules";
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

export function useCharacterCreatorSubmit(args: {
  form: FormState;
  selectedRuleset: Ruleset;
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
      selectedRuleset,
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

    setBusy(true);
    setError(null);
    try {
      const { body } = await buildCreatorSubmissionBody({
        api,
        form,
        selectedRuleset,
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

      navigate("/");
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
