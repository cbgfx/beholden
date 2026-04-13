import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import {
  Wrap,
  NoteEditDrawer,
} from "@/views/character/CharacterViewParts";
import {
  CharacterActionColumn,
  CharacterInventoryColumn,
  CharacterPrimaryColumn,
  CharacterSupportColumn,
} from "@/views/character/CharacterViewColumns";
import { buildCharacterViewDerivedState } from "@/views/character/CharacterViewDerivedState";
import { useCompendiumMonster } from "@/views/character/CharacterCompendiumMonsterHooks";
import { CharacterInfoDrawer, CharacterPolymorphDrawer } from "@/views/character/CharacterViewDrawers";
import {
  abilityMod,
  formatModifier,
  normalizeSpellTrackingKey,
} from "@/views/character/CharacterSheetUtils";
import type {
  AbilKey, CharacterData, PlayerNote,
} from "@/views/character/CharacterSheetTypes";
import {
  type Character,
  type SheetOverrides,
  SHEET_COLOR_PRESETS,
  getPolymorphConditionData,
} from "@/views/character/CharacterViewHelpers";
import { useCharacterData } from "@/views/character/useCharacterData";
import { useCharacterActions } from "@/views/character/useCharacterActions";
import { buildCharacterRuntimeActions } from "@/views/character/CharacterViewCombatActions";
import { buildCharacterHpActions } from "@/views/character/CharacterViewHpActions";
import { useCharacterSyncEffects } from "@/views/character/useCharacterSyncEffects";
import { useCharacterPolymorphControls } from "@/views/character/useCharacterPolymorphControls";

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function CharacterView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [hpAmount, setHpAmount] = useState("");
  const [hpSaving, setHpSaving] = useState(false);
  const [hpError, setHpError] = useState<string | null>(null);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const flashRef = useRef<number | null>(null);
  const hpInputRef = useRef<HTMLInputElement>(null);
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  const [condSaving, setCondSaving] = useState(false);
  const [xpPopupOpen, setXpPopupOpen] = useState(false);
  const [xpInput, setXpInput] = useState("");
  const [dsSaving, setDsSaving] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>([]);
  const [expandedClassFeatureIds, setExpandedClassFeatureIds] = useState<string[]>([]);
  const [noteDrawer, setNoteDrawer] = useState<{ scope: "player" | "shared"; note: PlayerNote | null } | null>(null);
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
  const [overridesDraft, setOverridesDraft] = useState<SheetOverrides>({ tempHp: 0, acBonus: 0, hpMaxBonus: 0 });
  const [abilityOverridesDraft, setAbilityOverridesDraft] = useState<Partial<Record<AbilKey, number>>>({});
  const [colorDraft, setColorDraft] = useState<string>(C.accentHl);
  const [overridesSaving, setOverridesSaving] = useState(false);
  const [concentrationAlert, setConcentrationAlert] = useState<{ dc: number } | null>(null);
  const [polymorphDrawerOpen, setPolymorphDrawerOpen] = useState(false);
  const [polymorphApplyingId, setPolymorphApplyingId] = useState<string | null>(null);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const portraitFileRef = useRef<HTMLInputElement>(null);
  const {
    char,
    setChar,
    classDetail,
    raceDetail,
    backgroundDetail,
    bgOriginFeatDetail,
    raceFeatDetail,
    classFeatDetails,
    levelUpFeatDetails,
    invocationDetails,
    loading,
    error,
    setError,
    fetchChar,
    characterData,
    primaryClassEntry,
  } = useCharacterData(id);
  const {
    polymorphQuery,
    setPolymorphQuery,
    polymorphTypeFilter,
    setPolymorphTypeFilter,
    polymorphCrMax,
    setPolymorphCrMax,
    polymorphTypeOptions,
    filteredPolymorphRows,
    polymorphRowsBusy,
    polymorphRowsError,
  } = useCharacterPolymorphControls(polymorphDrawerOpen);

  const handlePortraitSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !id) return;
    setPortraitUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const result = await api<{ ok: boolean; imageUrl: string }>(`/api/me/characters/${id}/image`, { method: "POST", body: fd });
      setChar((prev) => prev ? { ...prev, imageUrl: result.imageUrl } : prev);
    } catch (err) { console.error(err); }
    finally { setPortraitUploading(false); }
  }, [id]);

  useEffect(() => {
    const source = char?.overrides ?? characterData?.sheetOverrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
    setOverridesDraft({
      tempHp: Math.max(0, Math.floor(Number(source.tempHp ?? 0) || 0)),
      acBonus: Math.floor(Number(source.acBonus ?? 0) || 0),
      hpMaxBonus: Math.floor(Number(source.hpMaxBonus ?? 0) || 0),
    });
    setAbilityOverridesDraft((source.abilityScores && typeof source.abilityScores === "object")
      ? Object.fromEntries(
          Object.entries(source.abilityScores).filter(([, value]) => Number.isFinite(Number(value)))
        ) as Partial<Record<AbilKey, number>>
      : {});
  }, [
    char?.overrides?.tempHp,
    char?.overrides?.acBonus,
    char?.overrides?.hpMaxBonus,
    char?.overrides?.abilityScores,
    characterData?.sheetOverrides?.tempHp,
    characterData?.sheetOverrides?.acBonus,
    characterData?.sheetOverrides?.hpMaxBonus,
    characterData?.sheetOverrides?.abilityScores,
  ]);

  useEffect(() => {
    setColorDraft(char?.color ?? C.accentHl);
  }, [char?.color]);

  const polymorphCondition = getPolymorphConditionData(char?.conditions);
  const polymorphMonsterId = polymorphCondition?.polymorphMonsterId ?? null;
  const polymorphMonsterState = useCompendiumMonster(polymorphMonsterId, "Failed to load transformed form.");
  const derivedState = !loading && !error && char
    ? buildCharacterViewDerivedState({
        char,
        classDetail,
        raceDetail,
        backgroundDetail,
        bgOriginFeatDetail,
        raceFeatDetail,
        classFeatDetails,
        levelUpFeatDetails,
        invocationDetails,
        subclass: primaryClassEntry?.subclass ?? null,
        polymorphCondition,
        polymorphMonsterState,
      })
    : null;
  const syncedAcValue = derivedState ? derivedState.effectiveAc - (derivedState.overrides?.acBonus ?? 0) : null;
  useCharacterSyncEffects({ char, setChar, fetchChar, syncedAcValue });

  const currentCharacterDataForActions: CharacterData = (derivedState?.currentCharacterData ?? characterData ?? {}) as CharacterData;
  const playerNotesList: PlayerNote[] = currentCharacterDataForActions.playerNotesList ?? [];
  // Player-owned shared notes (editable)
  const sharedNotesList: PlayerNote[] = (() => {
    if (!char?.sharedNotes) return [];
    try { return JSON.parse(char.sharedNotes) as PlayerNote[]; } catch { return []; }
  })();
  // Campaign-level notes from DM — merged into the editable list, player version wins on ID clash
  const campaignNotesList: PlayerNote[] = (() => {
    if (!char?.campaignSharedNotes) return [];
    try { return JSON.parse(char.campaignSharedNotes) as PlayerNote[]; } catch { return []; }
  })();
  const playerNoteIds = new Set(sharedNotesList.map((n) => n.id));
  const allSharedNotes: PlayerNote[] = [
    ...campaignNotesList.filter((n) => !playerNoteIds.has(n.id)),
    ...sharedNotesList,
  ];
  const {
    saveCharacterData,
    saveSheetOverrides,
    savePlayerNotesList,
    saveCustomResistances,
    saveCustomImmunities,
    saveCustomTools,
    saveCustomLanguages,
    saveSharedNotesList,
    handleNoteSave,
    handleNoteDelete,
  } = useCharacterActions({
    char,
    setChar,
    characterData: characterData ?? undefined,
    currentCharacterData: currentCharacterDataForActions,
    playerNotesList,
    allSharedNotes,
    campaignNotesList,
    noteDrawer,
    setNoteDrawer,
    setExpandedNoteIds,
    overridesDraft,
    abilityOverridesDraft,
    colorDraft,
    setInfoDrawerOpen,
    setOverridesSaving,
  });

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char || !derivedState) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;

  const {
    prof,
    pb,
    hd,
    hitDieSize,
    hitDiceMax,
    hitDiceCurrent,
    inventory,
    scores,
    scoreExplanations,
    classFeaturesList,
    parsedFeatureEffects,
    grantedSpellData,
    classResourcesWithSpellCasts,
    polymorphName,
    rageActive,
    parsedDefenses,
    usesFlexiblePreparedList,
    preparedSpellLimit,
    preparedSpells,
    invocationSpellDamageBonuses,
    accentColor,
    overrides,
    featureHpMaxBonus,
    effectiveHpMax,
    xpEarned,
    xpNeeded,
    nonProficientArmorPenalty,
    hasDisadvantage,
    stealthDisadvantage,
    conMod,
    hasJackOfAllTrades,
    effectiveAc,
    effectiveSpeed,
    movementModes,
    tempHp,
    hpPct,
    tempPct,
    passivePerc,
    passiveInv,
    initiativeBonus,
    transformedCombatStats,
    saveBonuses,
    abilityCheckAdvantages,
    abilityCheckDisadvantages,
    saveAdvantages,
    saveDisadvantages,
    skillAdvantages,
    skillDisadvantages,
    rageDamageBonus,
    unarmedRageDamageBonus,
    senses,
    editableOverrideFields,
    identityFields,
  } = derivedState;
  const currentCharacterData = derivedState.currentCharacterData;
  const forcedPreparedSpellKeys = new Set(
    grantedSpellData.spells
      .filter((spell) => spell.mode === "always_prepared")
      .map((spell) => normalizeSpellTrackingKey(spell.spellName))
      .filter((key): key is string => Boolean(key)),
  );
  const {
    saveXp,
    saveHitDiceCurrent,
    saveUsedSpellSlots,
    savePreparedSpells,
    addTrackedSpell,
    removeTrackedSpell,
    handleItemChargeChange,
    changeResourceCurrent,
    handleShortRest,
    handleLongRest,
    handleFullRest,
    handleToggleInspiration,
    saveDeathSaves,
    revertPolymorph,
    applyPolymorphSelf,
    toggleCondition,
  } = buildCharacterRuntimeActions({
    char,
    setChar,
    classDetail,
    raceDetail,
    currentCharacterData,
    classResourcesWithSpellCasts,
    hitDiceMax,
    hitDiceCurrent,
    inventory,
    effectiveHpMax,
    overrides,
    polymorphCondition,
    saveCharacterData,
    setXpPopupOpen,
    setDsSaving,
    setCondSaving,
    fetchChar,
    setPolymorphApplyingId,
    setPolymorphDrawerOpen,
    preparedSpellLimit,
    usesFlexiblePreparedList,
    preparedSpells,
    forcedPreparedSpellKeys,
    normalizeSpellTrackingKey,
  });

  const { handleApplyHp } = buildCharacterHpActions({
    hpAmount,
    setHpAmount,
    setLastRoll,
    flashRef,
    hpInputRef,
    setHpError,
    setHpSaving,
    setConcentrationAlert,
    char,
    setChar,
    effectiveHpMax,
    overrides,
    polymorphCondition,
    revertPolymorph,
  });


  const _makeToggleExpanded = (setFn: React.Dispatch<React.SetStateAction<string[]>>) =>
    (id: string) => setFn((prev) => prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]);
  const toggleNoteExpanded = _makeToggleExpanded(setExpandedNoteIds);
  const toggleClassFeatureExpanded = _makeToggleExpanded(setExpandedClassFeatureIds);

  return (
    <Wrap wide>
      <input
        ref={portraitFileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePortraitSelected}
      />
      {concentrationAlert && (
        <div style={{
          marginBottom: 10, padding: "10px 14px", borderRadius: 10,
          background: "rgba(240, 165, 0, 0.15)", border: `1px solid ${C.accent}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ color: C.text, fontWeight: 700 }}>
            ⚠️ You are Concentrating — CON Save DC <strong>{concentrationAlert.dc}</strong>
          </span>
          <button
            onClick={() => setConcentrationAlert(null)}
            style={{ all: "unset", cursor: "pointer", color: C.muted, fontWeight: 900, fontSize: "var(--fs-title)", lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}
      {/* ── 4-column layout ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(420px, 1fr))", gap: 16, alignItems: "flex-start" }}>
        <CharacterPrimaryColumn
          hudProps={{
            char,
            accentColor,
            xpEarned,
            xpNeeded,
            xpInput,
            xpPopupOpen,
            setXpInput,
            setXpPopupOpen,
            saveXp,
            onOpenInfo: () => setInfoDrawerOpen(true),
            onLevelUp: () => navigate(`/characters/${char.id}/levelup`),
            onEdit: () => navigate(`/characters/${char.id}/edit`),
            onPortraitClick: () => portraitFileRef.current?.click(),
            portraitUploading,
            effectiveHpMax,
            tempHp,
            hpPct,
            tempPct,
            hpError,
            hpSaving,
            hpAmount,
            hd,
            lastRoll,
            hpInputRef,
            setHpError,
            setLastRoll,
            setHpAmount,
            handleApplyHp,
            inspirationActive: overrides.inspiration ?? false,
            handleToggleInspiration,
            condPickerOpen,
            setCondPickerOpen,
            condSaving,
            toggleCondition,
            dsSaving,
            saveDeathSaves,
            hpMaxBonus: overrides.hpMaxBonus ?? 0,
          }}
          abilitiesProps={{
            scores,
            scoreExplanations,
            pb,
            prof,
            saveBonuses,
            abilityCheckAdvantages,
            abilityCheckDisadvantages,
            saveAdvantages,
            saveDisadvantages,
            skillAdvantages,
            skillDisadvantages,
            accentColor,
            stealthDisadvantage,
            nonProficientArmorPenalty,
            hasJackOfAllTrades,
            mod: abilityMod,
            fmtMod: formatModifier,
          }}
          defensesProps={{
            resistances: parsedDefenses.resistances,
            damageImmunities: parsedDefenses.damageImmunities,
            conditionImmunities: parsedDefenses.conditionImmunities,
            senses,
            customResistances: currentCharacterData.customResistances ?? [],
            customImmunities: currentCharacterData.customImmunities ?? [],
            accentColor,
            onCustomResistancesChange: (value) => { void saveCustomResistances(value); },
            onCustomImmunitiesChange: (value) => { void saveCustomImmunities(value); },
          }}
          proficienciesProps={{
            prof,
            accentColor,
            customTools: currentCharacterData.customTools ?? [],
            customLanguages: currentCharacterData.customLanguages ?? [],
            onCustomToolsChange: (value) => { void saveCustomTools(value); },
            onCustomLanguagesChange: (value) => { void saveCustomLanguages(value); },
          }}
        />

        <CharacterActionColumn
          combatProps={{
            effectiveAc: transformedCombatStats?.effectiveAc ?? effectiveAc,
            speed: transformedCombatStats?.speed ?? effectiveSpeed,
            movementModes: transformedCombatStats?.movementModes ?? movementModes,
            level: char.level,
            className: transformedCombatStats?.className ?? char.className,
            initiativeBonus: transformedCombatStats?.initiativeBonus ?? initiativeBonus,
            strScore: transformedCombatStats?.strScore ?? scores.str,
            dexScore: transformedCombatStats?.dexScore ?? scores.dex,
            pb: transformedCombatStats?.pb ?? pb,
            passivePerc: transformedCombatStats?.passivePerc ?? passivePerc,
            passiveInv: transformedCombatStats?.passiveInv ?? passiveInv,
            accentColor,
            inventory,
            prof,
            parsedFeatureEffects,
            nonProficientArmorPenalty,
            hasDisadvantage,
            rageDamageBonus,
            unarmedRageDamageBonus,
            rageActive,
            showActions: !polymorphCondition,
          }}
          polymorphed={Boolean(polymorphCondition)}
          polymorphMonsterState={polymorphMonsterState}
          itemSpellsProps={{
            items: inventory,
            pb,
            intScore: scores.int,
            wisScore: scores.wis,
            chaScore: scores.cha,
            accentColor,
            onChargeChange: handleItemChargeChange,
            spellcastingBlocked: nonProficientArmorPenalty,
          }}
          richSpellsProps={{
            spells: prof?.spells ?? [],
            grantedSpells: grantedSpellData.spells,
            resources: classResourcesWithSpellCasts,
            pb,
            scores,
            accentColor,
            classDetail,
            charLevel: char.level,
            preparedLimit: preparedSpellLimit,
            usesFlexiblePreparedList,
            usedSpellSlots: currentCharacterData.usedSpellSlots ?? {},
            preparedSpells,
            onSlotsChange: saveUsedSpellSlots,
            onPreparedChange: savePreparedSpells,
            onAddSpell: addTrackedSpell,
            onRemoveSpell: removeTrackedSpell,
            addSpellSourceLabel: classDetail?.name ?? char.className ?? "Manual",
            onResourceChange: changeResourceCurrent,
            spellcastingBlocked: nonProficientArmorPenalty,
            spellDamageBonuses: invocationSpellDamageBonuses,
          }}
        />

        <CharacterInventoryColumn
          inventoryProps={{
            char,
            charData: char.characterData,
            parsedFeatureEffects,
            accentColor,
            campaignId: char.campaigns[0]?.campaignId ?? null,
            onSave: saveCharacterData,
          }}
          creaturesProps={{
            charData: char.characterData,
            accentColor,
            onSave: saveCharacterData,
          }}
        />

        <CharacterSupportColumn
          accentColor={accentColor}
          hasCampaign={char.campaigns.length > 0}
          hitDiceCurrent={hitDiceCurrent}
          hitDiceMax={hitDiceMax}
          hitDieSize={hitDieSize}
          hitDieConMod={conMod}
          featureHpMaxBonus={featureHpMaxBonus}
          classResources={classResourcesWithSpellCasts}
          playerNotesList={playerNotesList}
          allSharedNotes={allSharedNotes}
          classFeaturesList={classFeaturesList}
          expandedNoteIds={expandedNoteIds}
          expandedClassFeatureIds={expandedClassFeatureIds}
          onSaveHitDiceCurrent={(value) => saveHitDiceCurrent(value)}
          onShortRest={() => handleShortRest()}
          onLongRest={() => handleLongRest()}
          onFullRest={() => handleFullRest()}
          onChangeResourceCurrent={(key, delta) => changeResourceCurrent(key, delta)}
          onOpenPlayerNoteCreate={() => setNoteDrawer({ scope: "player", note: null })}
          onOpenSharedNoteCreate={() => setNoteDrawer({ scope: "shared", note: null })}
          onToggleNoteExpanded={toggleNoteExpanded}
          onToggleClassFeatureExpanded={toggleClassFeatureExpanded}
          onOpenPlayerNoteEdit={(note) => setNoteDrawer({ scope: "player", note })}
          onOpenSharedNoteEdit={(note) => setNoteDrawer({ scope: "shared", note })}
          onDeletePlayerNote={(id) => handleNoteDelete("player", id)}
          onDeleteSharedNote={(id) => handleNoteDelete("shared", id)}
          onSavePlayerNotesOrder={(list) => { void savePlayerNotesList(list); }}
          onSaveSharedNotesOrder={saveSharedNotesList}
          polymorphName={polymorphName || null}
          onOpenTransformSelf={() => setPolymorphDrawerOpen(true)}
          onRevertTransformSelf={polymorphCondition ? () => { void toggleCondition("polymorphed"); } : undefined}
        />
      </div>
      {/* end 4-column grid */}

      <CharacterPolymorphDrawer
        open={polymorphDrawerOpen}
        accentColor={accentColor}
        polymorphQuery={polymorphQuery}
        polymorphTypeFilter={polymorphTypeFilter}
        polymorphCrMax={polymorphCrMax}
        polymorphTypeOptions={polymorphTypeOptions}
        polymorphRowsBusy={polymorphRowsBusy}
        polymorphRowsError={polymorphRowsError}
        filteredPolymorphRows={filteredPolymorphRows}
        polymorphApplyingId={polymorphApplyingId}
        onClose={() => setPolymorphDrawerOpen(false)}
        onQueryChange={setPolymorphQuery}
        onTypeFilterChange={setPolymorphTypeFilter}
        onCrMaxChange={setPolymorphCrMax}
        onApply={(row) => applyPolymorphSelf(row)}
      />

      {/* Note edit drawer */}
      {noteDrawer && (
        <NoteEditDrawer
          scope={noteDrawer.scope}
          note={noteDrawer.note}
          accentColor={accentColor}
          onSave={handleNoteSave}
          onDelete={noteDrawer.note ? () => { handleNoteDelete(noteDrawer.scope, noteDrawer.note!.id); setNoteDrawer(null); } : undefined}
          onClose={() => setNoteDrawer(null)}
        />
      )}
      <CharacterInfoDrawer
        open={infoDrawerOpen}
        accentColor={accentColor}
        identityFields={identityFields}
        editableOverrideFields={editableOverrideFields}
        overridesDraft={overridesDraft}
        colorDraft={colorDraft}
        colorPresets={SHEET_COLOR_PRESETS}
        abilityOverridesDraft={abilityOverridesDraft}
        overridesSaving={overridesSaving}
        onClose={() => setInfoDrawerOpen(false)}
        onSave={() => saveSheetOverrides()}
        onColorChange={setColorDraft}
        onOverrideChange={(key, value) => {
          setOverridesDraft((prev) => ({
            ...prev,
            [key]: value,
          }));
        }}
        onAbilityOverrideChange={(key, value) => {
          setAbilityOverridesDraft((prev) => {
            const next = { ...prev };
            if (value == null || !Number.isFinite(value)) delete next[key];
            else next[key] = Math.floor(value);
            return next;
          });
        }}
      />
    </Wrap>
  );
}




