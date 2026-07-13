import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import {
  fetchBackgroundDetailV2,
  fetchClassDetailV2,
  fetchRaceDetailV2,
} from "@/services/compendiumApi";
import { useAuth } from "@/contexts/AuthContext";
import {
  parseFeatureGrants as parseFeatureGrantsFromRules,
} from "@/views/character/CharacterRuleParsers";
import {
  abilityMod,
  calcHpMax,
  classifyFeatSelection,
  extractClassStartingEquipment,
  getSpellcastingClassName,
  parseStartingEquipmentOptions,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  getGrowthChoiceSelectedAbility,
} from "@/views/character-creator/utils/GrowthChoiceUtils";
import type {
  ParsedFeatDetailLike as BackgroundFeat,
} from "@/views/character-creator/utils/FeatChoiceTypes";
import type {
  BgDetail,
  ClassDetail,
  LevelUpFeatDetail,
  RaceDetail,
  SpellSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import { StepHeader } from "@/views/character-creator/shared/CharacterCreatorParts";
import { CharacterCreatorSideSummary } from "@/views/character-creator/shared/CharacterCreatorSideSummary";
import { getStep5ChoiceState } from "@/views/character-creator/utils/CharacterCreatorStep5Utils";
import {
  getClassFeatChoiceLabel,
  getClassFeatOptionLabel,
  initForm,
  resolvedScores,
  type FormState,
  type Step,
} from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { renderCharacterCreatorStep, type CharacterCreatorStepRenderContext } from "@/views/character-creator/CharacterCreatorStepViews";
import { useCreatorCompendiumCatalogs } from "@/views/character-creator/useCreatorCompendiumCatalogs";
import { useCreatorEditHydration } from "@/views/character-creator/useCreatorEditHydration";
import { useCharacterCreatorDerivedState } from "@/views/character-creator/useCharacterCreatorDerivedState";
import { useCharacterCreatorSanitizers } from "@/views/character-creator/useCharacterCreatorSanitizers";
import { useCharacterCreatorFeatDetails } from "@/views/character-creator/useCharacterCreatorFeatDetails";
import { useCharacterCreatorSubmit } from "@/views/character-creator/useCharacterCreatorSubmit";


// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

const FALLBACK_CLASS_HIT_DICE: Record<string, number> = {
  barbarian: 12,
  fighter: 10,
  paladin: 10,
  ranger: 10,
  bard: 8,
  cleric: 8,
  druid: 8,
  monk: 8,
  rogue: 8,
  warlock: 8,
  sorcerer: 6,
  wizard: 6,
};

function inferHitDieFromClassName(value: string | null | undefined): number | null {
  const normalized = String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ");
  for (const [className, hitDie] of Object.entries(FALLBACK_CLASS_HIT_DICE)) {
    if (new RegExp(`\\b${className}\\b`, "i").test(normalized)) return hitDie;
  }
  return null;
}

function displayNameFromCompendiumId(value: string | null | undefined): string {
  const normalized = String(value ?? "")
    .replace(/^c_/, "")
    .replace(/^race_/, "")
    .replace(/^bg_/, "")
    .replace(/^background_/, "")
    .replace(/_/g, " ")
    .trim();
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function inferCreatorSpeed(baseSpeed: number, className: string, level: number): number {
  const normalizedClass = String(className ?? "").toLowerCase();
  let speed = baseSpeed;
  if (normalizedClass.includes("barbarian") && level >= 5) speed += 10;
  if (normalizedClass.includes("ranger") && level >= 6) speed += 10;
  return speed;
}

export function CharacterCreatorView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const isEditing = Boolean(editId);

  const [step, setStep] = React.useState<Step>(1);
  const [form, setForm] = React.useState<FormState>(() => initForm(user, searchParams));
  const [editLoading, setEditLoading] = React.useState(isEditing);
  const [error, setError] = React.useState<string | null>(null);

  // Compendium data
  const [classDetail, setClassDetail] = React.useState<ClassDetail | null>(null);
  const [raceDetail, setRaceDetail] = React.useState<RaceDetail | null>(null);
  const [raceFeatDetail, setRaceFeatDetail] = React.useState<BackgroundFeat | null>(null);
  const [bgOriginFeatDetail, setBgOriginFeatDetail] = React.useState<BackgroundFeat | null>(null);
  const [featDetailCache, setFeatDetailCache] = React.useState<Record<string, BackgroundFeat>>({});
  const [levelUpFeatDetails, setLevelUpFeatDetails] = React.useState<LevelUpFeatDetail[]>([]);
  const [classFeatDetails, setClassFeatDetails] = React.useState<Record<string, BackgroundFeat>>({});
  const [raceFeatSearch, setRaceFeatSearch] = React.useState("");
  const [bgOriginFeatSearch, setBgOriginFeatSearch] = React.useState("");
  const [bgDetail, setBgDetail] = React.useState<BgDetail | null>(null);
  // Spell lists (loaded when class is selected)
  const [classCantrips, setClassCantrips] = React.useState<SpellSummary[]>([]);
  const [classSpells, setClassSpells] = React.useState<SpellSummary[]>([]);
  const [classInvocations, setClassInvocations] = React.useState<SpellSummary[]>([]);

  // Track initially-assigned campaigns so we can diff on save in edit mode
  const initialCampaignIdsRef = React.useRef<string[]>([]);
  const prevClassIdRef = React.useRef<string | null>(null);
  const prevRaceIdRef = React.useRef<string | null>(null);
  const prevBgIdRef = React.useRef<string | null>(null);

  // Portrait selection (not part of form schema — uploaded separately after save)
  const [portraitFile, setPortraitFile] = React.useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = React.useState<string | null>(null);
  const portraitInputRef = React.useRef<HTMLInputElement>(null);
  const [editSummaryFallback, setEditSummaryFallback] = React.useState<{ className: string; species: string; hitDie: number | null; hpCurrent: number | null } | null>(null);

  // Search states for long lists (hoisted to avoid Rules-of-Hooks violations in inner fns)
  const [classSearch, setClassSearch] = React.useState("");
  const [raceSearch, setRaceSearch] = React.useState("");
  const [bgSearch, setBgSearch] = React.useState("");
  const catalogs = useCreatorCompendiumCatalogs();
  const classes = catalogs.classes;
  const races = catalogs.races;
  const bgs = catalogs.bgs;
  const featSummaries = catalogs.featSummaries;
  const campaigns = catalogs.campaigns;
  const resolvedRaceFeatDetail = form.chosenRaceFeatId
    ? (raceFeatDetail?.id === form.chosenRaceFeatId ? raceFeatDetail : featDetailCache[form.chosenRaceFeatId] ?? null)
    : null;
  const resolvedBgOriginFeatDetail = form.chosenBgOriginFeatId
    ? (bgOriginFeatDetail?.id === form.chosenBgOriginFeatId ? bgOriginFeatDetail : featDetailCache[form.chosenBgOriginFeatId] ?? null)
    : null;
  const {
    selectedClassSummary,
    selectedClassFeatDetails,
    selectedClassFeatureProficiencyChoices,
    selectedFeatGrantedAbilityBonuses,
    selectedFeatAbilityBonuses,
    step5SkillList,
    step5NumSkills,
    step5BgLangChoice,
    step5CoreLanguageChoice,
    step5ClassFeatChoices,
    step5ClassLanguageChoice,
    step5ClassExpertiseChoices,
    step5ClassToolProficiency,
    step5WeaponMasteryChoice,
    step5WeaponOptions,
    step5ChoiceState,
    step6SpellListChoices,
    step6ResolvedSpellChoices,
    selectedFeatSpellcastingAbilityChoices,
    growthChoiceDefinitions,
    featSpellChoiceOptions,
    growthOptionEntriesByKey,
    items,
    preparedSpellProgressionChoiceDefinitions,
    levelUpFeatLevels,
    availableLevelUpFeats,
    levelUpFeatConflict,
    eligibleInvocationIds,
  } = useCharacterCreatorDerivedState({
    classes,
    featSummaries,
    form,
    classDetail,
    raceDetail,
    bgDetail,
    resolvedRaceFeatDetail,
    resolvedBgOriginFeatDetail,
    classFeatDetails,
    levelUpFeatDetails,
    classCantrips,
    classInvocations,
  });
  const effectiveClassName = selectedClassSummary?.name ?? editSummaryFallback?.className ?? displayNameFromCompendiumId(form.classId);
  const effectiveRaceName = raceDetail?.name ?? races.find((r) => r.id === form.raceId)?.name ?? editSummaryFallback?.species ?? displayNameFromCompendiumId(form.raceId);
  const effectiveHitDie =
    classDetail?.hd ??
    selectedClassSummary?.hd ??
    editSummaryFallback?.hitDie ??
    inferHitDieFromClassName(effectiveClassName || form.classId) ??
    8;

  // Load compendium lists on mount

  useCreatorEditHydration({
    editId,
    setForm,
    setEditLoading,
    initialCampaignIdsRef,
    onHydrated: setEditSummaryFallback,
  });

  // Load class detail when selected
  React.useEffect(() => {
    if (!form.classId) {
      prevClassIdRef.current = null;
      setClassDetail(null);
      setClassFeatDetails({});
      return;
    }
    const prevClassId = prevClassIdRef.current;
    prevClassIdRef.current = form.classId;
    const shouldResetClassChoices = !isEditing || (prevClassId !== null && prevClassId !== form.classId);
    if (shouldResetClassChoices) {
      setForm((f) => ({
        ...f,
        chosenClassFeatIds: {},
        chosenClassLanguages: [],
        chosenClassEquipmentOption: null,
        chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("classfeat:"))),
      }));
    }
    setClassFeatDetails({});
    fetchClassDetailV2<ClassDetail>(form.classId).then(setClassDetail).catch(() => {});
  }, [form.classId, isEditing]);

  // Load spell lists once classDetail is known
  React.useEffect(() => {
    if (!classDetail) { setClassCantrips([]); setClassSpells([]); setClassInvocations([]); return; }
    const spellcastingClassName = getSpellcastingClassName(classDetail, form.level, form.subclass) ?? classDetail.name;
    const name = encodeURIComponent(spellcastingClassName);
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&level=0&limit=120&includeText=1&lite=1&excludeSpecial=1`).then(setClassCantrips).catch(() => {});
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&minLevel=1&maxLevel=9&limit=220&includeText=1&compact=1&lite=1&excludeSpecial=1`).then(setClassSpells).catch(() => {});
    // Eldritch Invocations live in their own spell list
    if (/warlock/i.test(classDetail.name)) {
      api<SpellSummary[]>("/api/spells/search?classes=Eldritch+Invocations&limit=150&includeText=1&lite=1").then(setClassInvocations).catch(() => {});
    } else {
      setClassInvocations([]);
    }
  }, [classDetail, form.level, form.subclass]);

  // Load race detail when selected — also reset race choices
  React.useEffect(() => {
    if (!form.raceId) { setRaceDetail(null); setRaceFeatDetail(null); return; }
    const prevRaceId = prevRaceIdRef.current;
    prevRaceIdRef.current = form.raceId;
    const shouldResetRaceChoices = !isEditing || (prevRaceId !== null && prevRaceId !== form.raceId);
    if (shouldResetRaceChoices) {
      setForm(f => ({
        ...f,
        chosenRaceSkills: [], chosenRaceLanguages: [], chosenRaceTools: [], chosenRaceFeatId: null, chosenRaceSize: null,
        chosenClassLanguages: [],
        chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("race:"))),
      }));
    }
    setRaceFeatDetail(null);
    fetchRaceDetailV2<RaceDetail>(form.raceId).then(setRaceDetail).catch(() => {});
  }, [form.raceId, isEditing]);

  useCharacterCreatorFeatDetails({
    chosenRaceFeatId: form.chosenRaceFeatId,
    chosenBgOriginFeatId: form.chosenBgOriginFeatId,
    chosenClassFeatIds: form.chosenClassFeatIds,
    chosenLevelUpFeats: form.chosenLevelUpFeats,
    setRaceFeatDetail,
    setBgOriginFeatDetail,
    setClassFeatDetails,
    setLevelUpFeatDetails,
    setFeatDetailCache,
  });

  useCharacterCreatorSanitizers({
    setForm,
    canSanitizeLevelUpFeats: !editLoading && Boolean(classDetail),
    levelUpFeatLevels,
    step6SpellListChoices,
    step6ResolvedSpellChoices,
    featSpellChoiceOptions,
    growthChoiceDefinitions,
    growthOptionEntriesByKey,
    preparedSpellProgressionChoiceDefinitions,
    classInvocations,
    eligibleInvocationIds,
  });

  // Load bg detail when selected
  React.useEffect(() => {
    if (!form.bgId) { setBgDetail(null); return; }
    const prevBgId = prevBgIdRef.current;
    prevBgIdRef.current = form.bgId;
    const shouldResetBgChoices = !isEditing || (prevBgId !== null && prevBgId !== form.bgId);
    setBgOriginFeatDetail(null);
    setBgDetail(null);
    if (shouldResetBgChoices) {
      setForm(f => ({
        ...f,
        chosenBgTools: [],
        chosenBgLanguages: [],
        chosenBgOriginFeatId: null,
        chosenBgEquipmentOption: null,
        chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("bg:"))),
        bgAbilityMode: "split",
        bgAbilityBonuses: {},
      }));
    }
    fetchBackgroundDetailV2<BgDetail>(form.bgId).then(setBgDetail).catch(() => {});
  }, [form.bgId, isEditing]);

  // Auto-select directly-granted background feats (e.g. Charlatan → Skilled)
  React.useEffect(() => {
    if (!bgDetail) return;
    const prof = bgDetail.proficiencies;
    if (!prof || prof.featChoice > 0 || prof.feats.length === 0) {
      return;
    }
    // Fixed background feats are already carried on the background detail itself.
    // Only true "choose a feat" backgrounds should populate chosenBgOriginFeatId.
    setForm((f) => (f.chosenBgOriginFeatId == null ? f : { ...f, chosenBgOriginFeatId: null }));
    return;
  }, [bgDetail]);

  // Auto-select the first feat for backgrounds that explicitly grant a feat choice.
  React.useEffect(() => {
    if (!bgDetail) return;
    const prof = bgDetail.proficiencies;
    if (!prof || prof.featChoice <= 0 || prof.feats.length === 0) return;
    const grantedName = prof.feats[0]?.name;
    if (!grantedName) return;
    const match = featSummaries.find((f) =>
      f.name.toLowerCase().startsWith(grantedName.toLowerCase())
    );
    if (match) {
      setForm((f) => f.chosenBgOriginFeatId === match.id ? f : { ...f, chosenBgOriginFeatId: match.id });
    }
  }, [bgDetail, featSummaries]);

  // Auto-select the first equipment option when bgDetail loads
  React.useEffect(() => {
    if (!bgDetail?.equipment) return;
    const options = parseStartingEquipmentOptions(bgDetail.equipment, bgDetail.equipmentOptions);
    if (options.length > 0) {
      setForm(f => f.chosenBgEquipmentOption ? f : { ...f, chosenBgEquipmentOption: options[0].id });
    }
  }, [bgDetail]);

  // Auto-select the first equipment option when classDetail loads
  React.useEffect(() => {
    if (!classDetail) return;
    const text = extractClassStartingEquipment(classDetail);
    const options = parseStartingEquipmentOptions(text);
    if (options.length > 0) {
      setForm(f => f.chosenClassEquipmentOption ? f : { ...f, chosenClassEquipmentOption: options[0].id });
    }
  }, [classDetail]);

  // Auto-calculate HP, AC, speed when class/race/scores change
  React.useEffect(() => {
    const hd = effectiveHitDie;
    const scores = resolvedScores(form, selectedFeatAbilityBonuses);
    const conMod = abilityMod(scores.con ?? 10);
    const dexMod = abilityMod(scores.dex ?? 10);
    const hp = calcHpMax(hd, form.level, conMod);
    const ac = 10 + dexMod;
    const baseSpeed = raceDetail?.speed ?? races.find((race) => race.id === form.raceId)?.speed ?? 30;
    const hpStr = String(hp);
    const acStr = String(ac);
    const speedStr = String(inferCreatorSpeed(baseSpeed, effectiveClassName, form.level));
    setForm((f) => (f.hpMax === hpStr && f.ac === acStr && f.speed === speedStr ? f : { ...f, hpMax: hpStr, ac: acStr, speed: speedStr }));
  }, [effectiveHitDie, effectiveClassName, raceDetail, races, form, resolvedRaceFeatDetail?.name, resolvedBgOriginFeatDetail?.name, featSummaries, selectedClassFeatDetails, selectedFeatAbilityBonuses, levelUpFeatDetails, bgDetail?.proficiencies?.feats, bgDetail?.traits]);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const { busy, handleSubmit } = useCharacterCreatorSubmit({
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
    fallbackClassName: effectiveClassName || null,
    fallbackHitDie: effectiveHitDie,
    fallbackSpecies: effectiveRaceName || null,
    existingHpCurrent: editSummaryFallback?.hpCurrent ?? null,
    editId,
    portraitFile,
    initialCampaignIdsRef,
    classifyFeatSelection,
    navigate,
    setError,
  });

  const handleSubmitWithChecks = React.useCallback(async () => {
    if (selectedFeatSpellcastingAbilityChoices.some((entry) => entry.chosen.length < entry.max)) {
      setError("Choose a spellcasting ability for each feat-granted spell before saving.");
      setStep(7);
      return;
    }
    await handleSubmit();
  }, [handleSubmit, selectedFeatSpellcastingAbilityChoices]);

  // ── Step renderers ──────────────────────────────────────────────────────────

  function renderStep(): { main: React.ReactNode; side: React.ReactNode } {
    return renderCharacterCreatorStep({
      step,
      form,
      setForm,
      setStep,
      setField: set,
      handleSubmit: handleSubmitWithChecks,
      sideSummary,
      classDetail,
      effectiveHitDie,
      classes,
      classSearch,
      setClassSearch,
      races,
      raceSearch,
      setRaceSearch,
      raceDetail,
      featSummaries,
      raceFeatSearch,
      setRaceFeatSearch,
      raceFeatDetail: resolvedRaceFeatDetail,
      bgs,
      bgSearch,
      setBgSearch,
      bgDetail,
      bgOriginFeatSearch,
      setBgOriginFeatSearch,
      bgOriginFeatDetail: resolvedBgOriginFeatDetail,
      levelUpFeatDetails,
      classFeatDetails,
      classCantrips,
      classSpells,
      classInvocations,
      featSpellChoiceOptions,
      growthOptionEntriesByKey,
      items,
      campaigns,
      error,
      busy,
      isEditing,
      parseFeatureGrants: parseFeatureGrantsFromRules,
      getStep5ChoiceState,
      step5SkillList,
      step5NumSkills,
      step5BgLangChoice,
      step5CoreLanguageChoice,
      step5ClassFeatChoices,
      step5ClassLanguageChoice,
      step5ClassExpertiseChoices,
      step5ClassToolProficiency,
      step5WeaponMasteryChoice,
      step5WeaponOptions,
      step5ChoiceState,
      step6SpellListChoices,
      step6ResolvedSpellChoices,
      selectedFeatSpellcastingAbilityChoices,
      selectedClassFeatureProficiencyChoices: selectedClassFeatureProficiencyChoices as CharacterCreatorStepRenderContext["selectedClassFeatureProficiencyChoices"],
      selectedFeatGrantedAbilityBonuses,
      selectedFeatAbilityBonuses,
      levelUpFeatLevels,
      availableLevelUpFeats,
      levelUpFeatConflict,
      getClassFeatChoiceLabel,
      getClassFeatOptionLabel,
      eligibleInvocationIds,
      growthChoiceDefinitions,
      preparedSpellProgressionChoiceDefinitions,
      getGrowthChoiceSelectedAbility,
      portraitInputRef,
      portraitPreview,
      setPortraitFile,
      setPortraitPreview,
    });
  }

  const sideSummary = (
    <CharacterCreatorSideSummary
      form={form}
      classDetail={classDetail}
      raceDetail={raceDetail}
      bgDetail={bgDetail}
      featAbilityBonuses={selectedFeatAbilityBonuses}
      fallbackClassName={classDetail ? undefined : effectiveClassName}
      fallbackClassHd={classDetail ? undefined : effectiveHitDie}
      fallbackRaceName={raceDetail ? undefined : effectiveRaceName}
      fallbackRaceSpeed={raceDetail ? undefined : races.find((r) => r.id === form.raceId)?.speed}
      fallbackBgName={bgDetail ? undefined : bgs.find((b) => b.id === form.bgId)?.name}
    />
  );

  // Step 10: Campaigns

  // ── Render ──────────────────────────────────────────────────────────────────

  if (editLoading) {
    return (
      <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px", color: C.muted }}>Loading…</div>
      </div>
    );
  }

  const { main, side } = renderStep();

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "36px 28px" }}>
        <h1 style={{ fontWeight: 900, fontSize: "var(--fs-hero)", margin: "0 0 8px", letterSpacing: -0.5 }}>
          {isEditing ? "Edit Character" : "Create Character"}
        </h1>
        <p style={{ margin: "0 0 24px", color: "rgba(160,180,220,0.55)", fontSize: "var(--fs-subtitle)" }}>
          {isEditing ? "Update your character details below." : "Build your character step by step."}
        </p>
        <StepHeader current={step} onStepClick={(s) => setStep(s as Step)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 32, alignItems: "start" }}>
          <div>{main}</div>
          <div style={{ position: "sticky", top: 36 }}>{side}</div>
        </div>
      </div>
    </div>
  );
}
