import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { Wrap } from "@/views/character/CharacterViewParts";
import { buildCharacterViewDerivedState } from "@/views/character/CharacterViewDerivedState";
import { useCompendiumMonster } from "@/views/character/CharacterCompendiumMonsterHooks";
import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import type { CharacterData } from "@/views/character/CharacterSheetTypes";
import { getPolymorphConditionData } from "@/views/character/CharacterViewHelpers";
import { useCharacterData } from "@/views/character/useCharacterData";
import { buildCharacterRuntimeActions } from "@/views/character/CharacterViewCombatActions";
import { buildCharacterHpActions } from "@/views/character/CharacterViewHpActions";
import { useCharacterSyncEffects } from "@/views/character/useCharacterSyncEffects";
import { useCharacterPolymorphControls } from "@/views/character/useCharacterPolymorphControls";
import type { CharacterCombatPanelsProps } from "@/views/character/CharacterCombatPanels";
import { hasIncapacitatingCondition } from "@beholden/shared/domain";
import { getExhaustionD20Penalty } from "@/views/character/CharacterExhaustion";
import { useCharacterLiveUpdates } from "@/views/character/useCharacterLiveUpdates";
import { useCharacterViewUiState, useCharacterViewUiSync } from "@/views/character/useCharacterViewUiState";
import { useCharacterViewNotes } from "@/views/character/useCharacterViewNotes";
import { CharacterViewLayout } from "@/views/character/CharacterViewLayout";

export function CharacterView() {
  const { id } = useParams<{ id: string }>();
  const ui = useCharacterViewUiState();
  const data = useCharacterData(id);
  const {
    char, setChar, classDetail, raceDetail, backgroundDetail, bgOriginFeatDetail,
    raceFeatDetail, classFeatDetails, levelUpFeatDetails, extraFeatDetails,
    invocationDetails, loading, error, fetchChar, characterData, primaryClassEntry,
  } = data;
  const handlePortraitSelected = useCharacterViewUiSync({ id, char, characterData, setChar, ui });
  const live = useCharacterLiveUpdates(id, fetchChar, ui.setConcentrationAlert);
  const polymorphControls = useCharacterPolymorphControls(ui.polymorphDrawerOpen);
  const polymorphCondition = getPolymorphConditionData(char?.conditions);
  const polymorphMonsterState = useCompendiumMonster(
    polymorphCondition?.polymorphMonsterId ?? null,
    "Failed to load transformed form.",
  );

  const derived = useMemo(() => !loading && !error && char
    ? buildCharacterViewDerivedState({
        char,
        classDetail,
        raceDetail,
        backgroundDetail,
        bgOriginFeatDetail,
        raceFeatDetail,
        classFeatDetails,
        levelUpFeatDetails,
        extraFeatDetails,
        invocationDetails,
        subclass: primaryClassEntry?.subclass ?? null,
        polymorphCondition,
        polymorphMonsterState,
      })
    : null,
    [
      loading, error, char, classDetail, raceDetail, backgroundDetail, bgOriginFeatDetail,
      raceFeatDetail, classFeatDetails, levelUpFeatDetails, extraFeatDetails,
      invocationDetails, primaryClassEntry?.subclass, polymorphCondition, polymorphMonsterState,
    ],
  );
  useCharacterSyncEffects({
    char,
    setChar,
    fetchChar,
    syncedAcValue: derived
      ? derived.effectiveAc - (derived.overrides?.acBonus ?? 0)
      : null,
    syncedHpMaxValue: derived ? derived.effectiveHpMax - (derived.overrides?.hpMaxBonus ?? 0) : null,
    syncedSpeedValue: derived?.effectiveSpeed ?? null,
  });

  const currentDataForActions = (derived?.currentCharacterData ?? characterData ?? {}) as CharacterData;
  const notes = useCharacterViewNotes({
    char,
    setChar,
    currentCharacterData: currentDataForActions,
    ui,
  });

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char || !derived) {
    return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;
  }

  const currentData = derived.currentCharacterData;
  const forcedPreparedSpellKeys = new Set(
    derived.grantedSpellData.spells
      .filter((spell) => spell.mode === "always_prepared")
      .map((spell) => normalizeSpellTrackingKey(spell.spellName))
      .filter((key): key is string => Boolean(key)),
  );
  const runtime = buildCharacterRuntimeActions({
    char,
    setChar,
    classDetail,
    raceDetail,
    currentCharacterData: currentData,
    classResourcesWithSpellCasts: derived.classResourcesWithSpellCasts,
    hitDiceMax: derived.hitDiceMax,
    inventory: derived.inventory,
    effectiveHpMaxWithoutOverrides: derived.effectiveHpMaxWithoutOverrides,
    overrides: derived.overrides,
    polymorphCondition,
    saveCharacterData: notes.saveCharacterData,
    setXpPopupOpen: ui.setXpPopupOpen,
    setDsSaving: ui.setDsSaving,
    setCondSaving: ui.setCondSaving,
    fetchChar,
    setPolymorphApplyingId: ui.setPolymorphApplyingId,
    setPolymorphDrawerOpen: ui.setPolymorphDrawerOpen,
    preparedSpellLimit: derived.preparedSpellLimit,
    usesFlexiblePreparedList: derived.usesFlexiblePreparedList,
    preparedSpells: derived.preparedSpells,
    forcedPreparedSpellKeys,
    normalizeSpellTrackingKey,
  });
  const hpActions = buildCharacterHpActions({
    hpAmount: ui.hpAmount,
    setHpAmount: ui.setHpAmount,
    setLastRoll: ui.setLastRoll,
    flashRef: ui.flashRef,
    hpInputRef: ui.hpInputRef,
    setHpError: ui.setHpError,
    setHpSaving: ui.setHpSaving,
    setConcentrationAlert: ui.setConcentrationAlert,
    char,
    setChar,
    effectiveHpMax: derived.effectiveHpMax,
    overrides: derived.overrides,
    polymorphCondition,
    revertPolymorph: runtime.revertPolymorph,
  });

  const handleAddFeat = async (feat: { id: string; name: string }, abilityChoices: string[]) => {
    const current = Array.isArray(currentData.extraFeatIds) ? currentData.extraFeatIds : [];
    if (current.includes(feat.id)) return;
    const choices = { ...(currentData.extraFeatAbilityChoices ?? {}) };
    if (abilityChoices.length > 0) choices[feat.id] = abilityChoices;
    await notes.saveCharacterData({
      extraFeatIds: [...current, feat.id],
      extraFeatAbilityChoices: choices,
    });
  };
  const handleRemoveExtraFeat = async (featId: string) => {
    const current = Array.isArray(currentData.extraFeatIds) ? currentData.extraFeatIds : [];
    const choices = { ...(currentData.extraFeatAbilityChoices ?? {}) };
    delete choices[featId];
    await notes.saveCharacterData({
      extraFeatIds: current.filter((entry) => entry !== featId),
      extraFeatAbilityChoices: choices,
    });
  };

  const exhaustion = currentData.exhaustion ?? 0;
  const combatProps = {
    effectiveAc: derived.transformedCombatStats?.effectiveAc ?? derived.effectiveAc,
    speed: derived.transformedCombatStats?.speed ?? derived.effectiveSpeed,
    movementModes: derived.transformedCombatStats?.movementModes ?? derived.movementModes,
    level: char.level,
    initiativeBonus: (derived.transformedCombatStats?.initiativeBonus ?? derived.initiativeBonus)
      - getExhaustionD20Penalty(exhaustion),
    strScore: derived.transformedCombatStats?.strScore ?? derived.scores.str,
    dexScore: derived.transformedCombatStats?.dexScore ?? derived.scores.dex,
    pb: derived.transformedCombatStats?.pb ?? derived.pb,
    passivePerc: derived.transformedCombatStats?.passivePerc ?? derived.passivePerc,
    accentColor: derived.accentColor,
    inventory: derived.inventory,
    prof: derived.prof,
    parsedFeatureEffects: derived.parsedFeatureEffects,
    nonProficientArmorPenalty: derived.nonProficientArmorPenalty,
    hasDisadvantage: derived.hasDisadvantage,
    rageDamageBonus: derived.rageDamageBonus,
    unarmedRageDamageBonus: derived.unarmedRageDamageBonus,
    rageActive: derived.rageActive,
    exhaustion,
    showActions: !polymorphCondition,
    reactionUsed: live.combatStatus?.usedReaction ?? false,
    onToggleReaction: live.combatStatus ? live.toggleReaction : null,
    incapacitated: hasIncapacitatingCondition(char.conditions),
  } satisfies CharacterCombatPanelsProps;

  return (
    <CharacterViewLayout model={{
      char,
      data,
      derived,
      ui,
      notes,
      runtime,
      hpActions,
      live,
      polymorphControls,
      polymorphCondition,
      polymorphMonsterState,
      combatProps,
      handlePortraitSelected,
      handleAddFeat,
      handleRemoveExtraFeat,
      applyPolymorphSelf: runtime.applyPolymorphSelf,
    }} />
  );
}
