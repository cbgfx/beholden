import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import { CharacterInitiativePrompt } from "@/views/character/CharacterInitiativePrompt";
import { IconBastions, IconPlayer } from "@/icons";
import { CharacterHudXpPopup } from "@/views/character/CharacterHudXpPopup";
import {
  Wrap,
  NoteEditDrawer,
} from "@/views/character/CharacterViewParts";

function stripEditionTag(s: string): string {
  return s.replace(/\s*\[(?:5\.5e|2024|5e|5\.0)\]\s*$/i, "").trim();
}

function IconCharacterInfo({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M453.295 17.117c-.546 7.232 1.619 15.478 5.957 22.612 4.338 7.133 10.666 12.847 17.338 15.69 9.655-11.206-5.483-37.974-20.092-38.624-1.09-.07-2.254.137-3.203.322zm-111.547 8.38L329.492 49.61l61.018 100.326 25.627-2.127 13.676-21.777-9.063-14.9-27.34 16.628-37.931-62.371L350.8 57.7l27.34-16.628-9.346-15.368zm93.977 1.62-60.194 36.61 23.905 39.303 60.193-36.61c-6.345-4.604-11.676-10.635-15.754-17.34-4.078-6.704-6.981-14.21-8.15-21.963zm-125.01 19.711-161.647 2.62c10.403 24.036 7.492 47.197-4.388 65.648-18.658-14.237-44.341-15.374-63.407-17.717-14.06 123.827-6.22 225.967-6.271 342.149-.004 9.469-1.157 23.12 4.826 32.947 1.887 3.1 4.37 5.928 8.129 8.342 17.708-6.206 41.405-12.44 54.87-22.274-6.951-.825-14.755.952-21.138.955-8.458-.04-19.144-6.11-24.748-19.496-2.919-6.973-6.636-18.193-.181-29.072 2.838-4.785 9.383-10.302 14.26-10.328 94.651.504 191.392-.32 279.568.154-5.523-76.851-10.013-154.096-5.53-232.308l-4.146.343-14.842-24.404-66.867 40.668 6.781 10.598-15.162 9.699-59.097-92.371 15.16-9.7L255 115.966l68.46-41.637-11.95-19.65-2.606-4.285zm-180.17 4.383c-15.366 8.213-29.102 17.702-40.99 28.707 16.167 1.495 33.74 3.063 48.64 9.95 3.139-13.836-3.247-26.896-7.65-38.657zm202.268 38.494-66.645 40.534 7.275 11.962 33.325-20.265 9.351 15.377-33.322 20.267 7.277 11.963 66.643-40.533zM201.41 136.278l.445 17.992c-30.522.253-58.62 2.029-90.013 2.11v-18a35163.72 35163.72 0 0 0 89.568-2.103zm144.983 78.98.24 17.996-234.346 3.143-.242-17.996zm.078 40.684.408 17.992-123.654 2.81-.41-17.994zm-235.178 3.097h90.602v17.998h-90.602zm234.795 33.237.406 17.992-62.158 1.406-.406-17.994zm-83.686 1.455.338 17.996-150.3 2.808-.337-17.994zm85.946 52.806.402 17.995-125.647 2.808-.402-17.992zm-196.323 70.79c10.05 9.261 17.925 22.065 15.078 36.718-2.074 10.682-10.422 17.606-19.814 23.106s-20.775 9.866-32.512 13.914a1395.68 1395.68 0 0 1-12.238 4.154l301.387-7.672c7.772-.45 14.658-5.66 19.734-13.406 5.082-7.754 7.477-17.817 6.895-23.236-.583-5.419-4.857-14.677-10.973-21.48-6.116-6.805-13.547-10.824-19.025-10.618l-.198.008zm-39.785 2.787c-1.07 1.802-.466 8.714 1.303 12.939 3.72 8.887 6.028 8.437 8.232 8.447 8.877 2.102 17.347.269 25.85-1.025-2.053-4.123-5.283-8.704-10.283-12.113-4.12-2.809-20.675-15.634-25.102-8.248z" />
    </svg>
  );
}
import {
  CharacterActionColumn,
  CharacterInventoryColumn,
  CharacterPrimaryColumn,
  CharacterSupportColumn,
} from "@/views/character/CharacterViewColumns";
import { buildCharacterViewDerivedState } from "@/views/character/CharacterViewDerivedState";
import { useCompendiumMonster } from "@/views/character/CharacterCompendiumMonsterHooks";
import { CharacterInfoDrawer, CharacterPolymorphDrawer } from "@/views/character/CharacterViewDrawers";
import { CharacterFeatPickerModal } from "@/views/character/CharacterFeatPickerModal";
import {
  abilityMod,
  formatModifier,
  normalizeSpellTrackingKey,
} from "@/views/character/CharacterSheetUtils";
import type {
  AbilKey, CharacterData, PlayerNote,
} from "@/views/character/CharacterSheetTypes";
import {
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
import type { CharacterCombatPanelsProps } from "@/views/character/CharacterCombatPanels";
import { getExhaustionD20Penalty } from "@/views/character/CharacterExhaustion";
import { useCharacterLiveUpdates } from "@/views/character/useCharacterLiveUpdates";

type SheetView = "play" | "gear" | "reference" | "all";

const SHEET_VIEWS: { id: SheetView; label: string; description: string }[] = [
  { id: "play", label: "Combat", description: "Character, actions, and upkeep" },
  { id: "gear", label: "Gear", description: "Character and inventory" },
  { id: "reference", label: "Reference", description: "Character, notes, and features" },
  { id: "all", label: "All", description: "The complete four-column sheet" },
];

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
  const [featPickerOpen, setFeatPickerOpen] = useState(false);
  const [polymorphDrawerOpen, setPolymorphDrawerOpen] = useState(false);
  const [polymorphApplyingId, setPolymorphApplyingId] = useState<string | null>(null);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const portraitFileRef = useRef<HTMLInputElement>(null);
  const [sheetView, setSheetView] = useState<SheetView>(() => {
    try {
      const saved = localStorage.getItem("character-sheet:view");
      if (SHEET_VIEWS.some((view) => view.id === saved)) return saved as SheetView;
    } catch { /* ignore */ }
    return "play";
  });
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
    extraFeatDetails,
    invocationDetails,
    loading,
    error,
    fetchChar,
    characterData,
    primaryClassEntry,
  } = useCharacterData(id);

  const {
    activeBastion,
    initiativePrompt,
    refreshInitiativePrompt,
    dismissInitiativePrompt,
  } = useCharacterLiveUpdates(id, fetchChar);

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
  }, [id, setChar]);

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
  }, [char?.overrides, characterData?.sheetOverrides]);

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
        extraFeatDetails,
        invocationDetails,
        subclass: primaryClassEntry?.subclass ?? null,
        polymorphCondition,
        polymorphMonsterState,
      })
    : null;
  const syncedAcValue = derivedState ? derivedState.effectiveAc - (derivedState.overrides?.acBonus ?? 0) : null;
  const syncedSpeedValue = derivedState?.effectiveSpeed ?? null;
  useCharacterSyncEffects({ char, setChar, fetchChar, syncedAcValue, syncedSpeedValue });

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
    passivePerc,
    initiativeBonus,
    spellSaveDcBonus,
    transformedCombatStats,
    saveBonuses,
    skillBonuses,
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
  const exhaustionLevel = currentCharacterData.exhaustion ?? 0;
  const exhaustionD20Penalty = getExhaustionD20Penalty(exhaustionLevel);
  const identityLabels = [
    char.className,
    currentCharacterData.classes?.[0]?.subclass,
    char.species,
  ].filter((item): item is string => Boolean(item));
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

  const handleAddFeat = async (feat: { id: string; name: string }, abilityChoices: string[]) => {
    const current = Array.isArray(currentCharacterData.extraFeatIds) ? currentCharacterData.extraFeatIds : [];
    if (current.includes(feat.id)) return;
    const nextChoices = { ...(currentCharacterData.extraFeatAbilityChoices ?? {}) };
    if (abilityChoices.length > 0) nextChoices[feat.id] = abilityChoices;
    await saveCharacterData({
      ...currentCharacterData,
      extraFeatIds: [...current, feat.id],
      extraFeatAbilityChoices: nextChoices,
    });
  };

  const handleRemoveExtraFeat = async (featId: string) => {
    const current = Array.isArray(currentCharacterData.extraFeatIds) ? currentCharacterData.extraFeatIds : [];
    const nextChoices = { ...(currentCharacterData.extraFeatAbilityChoices ?? {}) };
    delete nextChoices[featId];
    await saveCharacterData({
      ...currentCharacterData,
      extraFeatIds: current.filter((id) => id !== featId),
      extraFeatAbilityChoices: nextChoices,
    });
  };

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
  const combatProps = {
    effectiveAc: transformedCombatStats?.effectiveAc ?? effectiveAc,
    speed: transformedCombatStats?.speed ?? effectiveSpeed,
    movementModes: transformedCombatStats?.movementModes ?? movementModes,
    level: char.level,
    className: transformedCombatStats?.className ?? char.className,
    initiativeBonus: (transformedCombatStats?.initiativeBonus ?? initiativeBonus) - exhaustionD20Penalty,
    strScore: transformedCombatStats?.strScore ?? scores.str,
    dexScore: transformedCombatStats?.dexScore ?? scores.dex,
    pb: transformedCombatStats?.pb ?? pb,
    passivePerc: transformedCombatStats?.passivePerc ?? passivePerc,
    accentColor,
    inventory,
    prof,
    parsedFeatureEffects,
    nonProficientArmorPenalty,
    hasDisadvantage,
    rageDamageBonus,
    unarmedRageDamageBonus,
    rageActive,
    exhaustion: exhaustionLevel,
    showActions: !polymorphCondition,
  } satisfies CharacterCombatPanelsProps;

  return (
    <Wrap wide minWidth={sheetView === "all" ? 1760 : sheetView === "play" ? 1260 : 880}>
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
      <nav
        aria-label="Character sheet sections"
        style={{
          position: "sticky", top: 0, zIndex: 30,
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 14, padding: "5px 8px",
          border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12,
          background: "rgba(10,18,33,0.92)", backdropFilter: "blur(14px)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
        }}
      >
        {/* Left — identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
          <div
            onClick={() => portraitFileRef.current?.click()}
            style={{
              width: 46, height: 46, borderRadius: 10, flexShrink: 0,
              background: `${accentColor}22`, border: `2px solid ${accentColor}55`,
              overflow: "hidden", cursor: "pointer", position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            {char.imageUrl
              ? <img src={char.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <IconPlayer size={23} style={{ opacity: 0.35 }} />
            }
            {portraitUploading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--fs-tiny)", color: "#fff" }}>…</div>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: "var(--fs-body)", color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                {char.name}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "2px 4px", flexWrap: "nowrap", marginTop: 1 }}>
              {identityLabels.map((item, i, arr) => (
                  <React.Fragment key={i}>
                    <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, whiteSpace: "nowrap" }}>{stripEditionTag(item)}</span>
                    {i < arr.length - 1 && <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, opacity: 0.4 }}>·</span>}
                  </React.Fragment>
                ))}
            </div>
          </div>
          <button
            onClick={() => setInfoDrawerOpen(true)}
            title="Character Information"
            style={{ width: 40, height: 32, padding: 0, borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", color: C.muted, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
          >
            <IconCharacterInfo size={19} />
          </button>
          <button
            type="button"
            title="Edit character"
            onClick={() => navigate(`/characters/${char.id}/edit`)}
            style={{ appearance: "none", cursor: "pointer", fontFamily: "inherit", height: 32, padding: "0 16px", borderRadius: 8, color: C.muted, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", fontSize: "var(--fs-medium)", fontWeight: 700, flexShrink: 0 }}
          >
            Edit
          </button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Center — view tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 3, padding: 3, borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {SHEET_VIEWS.map((view) => {
            const selected = sheetView === view.id;
            return (
              <button
                key={view.id}
                type="button"
                aria-pressed={selected}
                title={view.description}
                onClick={() => {
                  setSheetView(view.id);
                  try { localStorage.setItem("character-sheet:view", view.id); } catch { /* ignore */ }
                }}
                style={{
                  appearance: "none", cursor: "pointer", boxSizing: "border-box",
                  border: 0, fontFamily: "inherit",
                  padding: "5px 13px", borderRadius: 7,
                  color: selected ? "#eaf7ff" : C.muted,
                  background: selected ? `${accentColor}24` : "transparent",
                  boxShadow: selected ? `inset 0 0 0 1px ${accentColor}55` : "none",
                  fontSize: "var(--fs-small)", fontWeight: selected ? 800 : 650,
                  transition: "background 120ms ease, color 120ms ease, box-shadow 120ms ease",
                }}
              >
                {view.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Right — bastion · level · xp */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {activeBastion && (
            <button
              type="button"
              title={`Bastion: ${activeBastion.name}`}
              onClick={() => navigate(`/campaigns/${activeBastion.campaignId}/bastions/${activeBastion.id}`)}
              style={{
                appearance: "none", cursor: "pointer", boxSizing: "border-box",
                height: 32, padding: "0 12px", borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)",
                color: C.muted, display: "inline-flex", alignItems: "center", gap: 7,
                fontSize: "var(--fs-medium)", fontWeight: 700,
              }}
            >
              <IconBastions size={19} />
              {activeBastion.name}
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "var(--fs-title)", fontWeight: 800, color: accentColor, whiteSpace: "nowrap" }}>
              Lv {char.level}
            </span>
            {xpEarned >= xpNeeded && xpNeeded > 0 && (
              <button
                onClick={() => navigate(`/characters/${char.id}/levelup`)}
                style={{
                  padding: "2px 7px", borderRadius: 6, cursor: "pointer", flexShrink: 0,
                  background: `${accentColor}22`, border: `1px solid ${accentColor}66`,
                  color: accentColor, fontWeight: 700, fontSize: "var(--fs-tiny)",
                }}
              >↑</button>
            )}
          </div>
          <CharacterHudXpPopup
            xpEarned={xpEarned}
            xpNeeded={xpNeeded}
            xpInput={xpInput}
            xpPopupOpen={xpPopupOpen}
            setXpInput={setXpInput}
            setXpPopupOpen={setXpPopupOpen}
            saveXp={saveXp}
            accentColor={accentColor}
          />
        </div>
      </nav>

      <div style={{
        display: "grid",
        gridTemplateColumns:
          sheetView === "all"
            ? "repeat(4, minmax(420px, 1fr))"
            : sheetView === "play"
              ? "minmax(390px, 0.95fr) minmax(460px, 1.15fr) minmax(390px, 0.95fr)"
              : "minmax(390px, 0.9fr) minmax(460px, 1.1fr)",
        gap: 16,
        alignItems: "flex-start",
      }}>
        <CharacterPrimaryColumn
          combatProps={combatProps}
          hudProps={{
            char,
            accentColor,
            effectiveHpMax,
            tempHp,
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
            concentrationSpell: currentCharacterData.concentrationSpell ?? null,
            onConcentrationSpellChange: (spell: string | null) => { void saveCharacterData({ ...currentCharacterData, concentrationSpell: spell }); },
            concentrationSpellNames: Array.from(new Set([
              ...grantedSpellData.spells.map((s) => s.spellName),
              ...(prof?.spells ?? []).map((s) => s.name),
            ])).sort((a, b) => a.localeCompare(b)),
          }}
          abilitiesProps={{
            scores,
            scoreExplanations,
            pb,
            prof,
            saveBonuses,
            skillBonuses,
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
            d20TestPenalty: exhaustionD20Penalty,
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

        {(sheetView === "play" || sheetView === "all") && (
        <CharacterActionColumn
          combatProps={combatProps}
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
            spellSaveDcBonus,
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
            spellSaveDcBonus,
          }}
        />
        )}

        {(sheetView === "gear" || sheetView === "all") && (
        <CharacterInventoryColumn
          inventoryProps={{
            char,
            charData: char.characterData,
            parsedFeatureEffects,
            accentColor,
            campaignId: char.campaigns[0]?.campaignId ?? null,
            onSave: saveCharacterData,
          }}
        />
        )}

        {(sheetView === "play" || sheetView === "reference" || sheetView === "all") && (
        <CharacterSupportColumn
          accentColor={accentColor}
          hasCampaign={char.campaigns.length > 0}
          hitDiceCurrent={hitDiceCurrent}
          hitDiceMax={hitDiceMax}
          hitDieSize={hitDieSize}
          hitDieConMod={conMod}
          featureHpMaxBonus={featureHpMaxBonus}
          exhaustion={exhaustionLevel}
          classResources={classResourcesWithSpellCasts}
          playerNotesList={playerNotesList}
          allSharedNotes={allSharedNotes}
          classFeaturesList={classFeaturesList}
          expandedNoteIds={expandedNoteIds}
          expandedClassFeatureIds={expandedClassFeatureIds}
          onSaveHitDiceCurrent={(value) => saveHitDiceCurrent(value)}
          onShortRest={() => handleShortRest()}
          onLongRest={() => handleLongRest()}
          onExhaustionChange={(value) => { void saveCharacterData({ ...currentCharacterData, exhaustion: value }); }}
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
          showReferenceContent={sheetView !== "play"}
          creaturesProps={sheetView === "play" || sheetView === "all" ? {
            charData: char.characterData,
            accentColor,
            onSave: saveCharacterData,
          } : undefined}
          polymorphName={polymorphName || null}
          onOpenTransformSelf={() => setPolymorphDrawerOpen(true)}
          onRevertTransformSelf={polymorphCondition ? () => { void toggleCondition("polymorphed"); } : undefined}
          onOpenFeatPicker={() => setFeatPickerOpen(true)}
          onRemoveExtraFeat={handleRemoveExtraFeat}
        />
        )}
      </div>

      <CharacterFeatPickerModal
        isOpen={featPickerOpen}
        accentColor={accentColor}
        currentFeatIds={currentCharacterData.extraFeatIds ?? []}
        existingFeatureNames={classFeaturesList.map((f) => f.name)}
        onClose={() => setFeatPickerOpen(false)}
        onAdd={(feat, abilityChoices) => { void handleAddFeat(feat, abilityChoices); }}
      />

      {initiativePrompt && (
        <CharacterInitiativePrompt
          encounterId={initiativePrompt.encounterId}
          combatantId={initiativePrompt.combatantId}
          initiativeBonus={(transformedCombatStats?.initiativeBonus ?? initiativeBonus) - exhaustionD20Penalty}
          accentColor={accentColor}
          onClose={() => void dismissInitiativePrompt(initiativePrompt.combatantId)}
          onSubmitted={() => { void refreshInitiativePrompt(); }}
        />
      )}

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




