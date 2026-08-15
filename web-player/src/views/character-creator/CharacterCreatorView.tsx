import React from "react";
import { getInvocationFeatChoices } from "@/domain/character/invocationFeatChoices";
import { useInvocationGrantedFeatChoices } from "@/views/shared/useInvocationGrantedFeatChoices";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { C } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import {
  abilityMod,
  calcHpMax,
  classifyFeatSelection,
  getCantripCount,
  getClassFeatureTable,
  getMaxSlotLevel,
  getPreparedSpellCount,
  getSubclassLevel,
  parseStartingEquipmentOptions,
  tableValueAtLevel,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import { trimAcquiredIdsForLevel } from "@/domain/character/spellAcquisition";
import {
  getGrowthChoiceSelectedAbility,
} from "@/views/character-creator/utils/GrowthChoiceUtils";
import { deriveCreatorSheetFacts } from "@/views/character-creator/utils/CharacterCreatorDerivedStats";
import { parseAppliedClassFeatureEffects, parseAppliedSpeciesTraitEffects } from "@/views/character-creator/utils/CharacterCreatorClassFeatureUtils";
import type {
  ParsedFeatDetailLike as BackgroundFeat,
} from "@/views/character-creator/utils/FeatChoiceTypes";
import type {
  LevelUpFeatDetail,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import { StepHeader } from "@/views/character-creator/shared/CharacterCreatorParts";
import { CharacterCreatorSideSummary } from "@/views/character-creator/shared/CharacterCreatorSideSummary";
import { getStep5ChoiceState } from "@/views/character-creator/utils/CharacterCreatorStep5Utils";
import {
  deriveRaceAbilityBonuses,
  getClassFeatChoiceLabel,
  getClassFeatOptionLabel,
  getOptionalGroups,
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
import { useCreatorSelectedCompendium } from "@/views/character-creator/useCreatorSelectedCompendium";


// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

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


export function CharacterCreatorView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const isEditing = Boolean(editId);

  const [step, setStep] = React.useState<Step>(isEditing ? 2 : 1);
  const [form, setForm] = React.useState<FormState>(() => initForm(user, searchParams));
  const [editLoading, setEditLoading] = React.useState(isEditing);
  const [error, setError] = React.useState<string | null>(null);

  // A submission error describes the form state at the moment it was thrown; once the user
  // changes anything, that description is stale (e.g. "choose 2 weapon masteries" after they
  // just did) and must not linger until the next submit attempt re-evaluates it.
  React.useEffect(() => {
    setError(null);
  }, [form]);

  // Compendium data
  const [raceFeatDetail, setRaceFeatDetail] = React.useState<BackgroundFeat | null>(null);
  const [bgOriginFeatDetail, setBgOriginFeatDetail] = React.useState<BackgroundFeat | null>(null);
  const [featDetailCache, setFeatDetailCache] = React.useState<Record<string, BackgroundFeat>>({});
  const [levelUpFeatDetails, setLevelUpFeatDetails] = React.useState<LevelUpFeatDetail[]>([]);
  const [classFeatDetails, setClassFeatDetails] = React.useState<Record<string, BackgroundFeat>>({});
  const [raceFeatSearch, setRaceFeatSearch] = React.useState("");
  const [bgOriginFeatSearch, setBgOriginFeatSearch] = React.useState("");
  const { classDetail, raceDetail, bgDetail, classCantrips, classSpells, classInvocations } = useCreatorSelectedCompendium({ form, setForm, isEditing });

  // Track initially-assigned campaigns so we can diff on save in edit mode
  const initialCampaignIdsRef = React.useRef<string[]>([]);

  // Portrait selection (not part of form schema — uploaded separately after save)
  const [portraitFile, setPortraitFile] = React.useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = React.useState<string | null>(null);
  const portraitInputRef = React.useRef<HTMLInputElement>(null);
  const [editSummaryFallback, setEditSummaryFallback] = React.useState<{
    className: string;
    species: string;
    hitDie: number | null;
    hpCurrent: number | null;
    extraFeatIds: string[];
    invocationFeatIds: string[];
    existingSpells: Array<{ id?: string; level?: number | null }>;
    existingInvocations: Array<{ id?: string; level?: number | null }>;
    existingAcquisitionLevels: Record<string, number | null>;
    existingClasses: Array<{ id?: string; classId?: string | null; className?: string | null; level?: number; subclass?: string | null }>;
    existingSelectedFeatureNames: string[];
    existingProficiencies: Partial<ProficiencyMap>;
  } | null>(null);

  // Search states for long lists (hoisted to avoid Rules-of-Hooks violations in inner fns)
  const [classSearch, setClassSearch] = React.useState("");
  const [raceSearch, setRaceSearch] = React.useState("");
  const [bgSearch, setBgSearch] = React.useState("");
  const catalogs = useCreatorCompendiumCatalogs(form.ruleset ?? undefined);
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
  const invocationFeatChoices = React.useMemo(
    () => getInvocationFeatChoices(classInvocations, form.chosenInvocations, featSummaries),
    [classInvocations, featSummaries, form.chosenInvocations],
  );
  const invocationGrantedFeatChoices = useInvocationGrantedFeatChoices({
    ruleset: form.ruleset ?? "5.5e",
    choices: invocationFeatChoices,
    selectedOptions: form.chosenFeatOptions,
    level: form.level,
  });
  const allFeatSpellChoiceOptions = React.useMemo(
    () => ({ ...featSpellChoiceOptions, ...invocationGrantedFeatChoices.spellOptions }),
    [featSpellChoiceOptions, invocationGrantedFeatChoices.spellOptions],
  );
  const effectiveClassName = selectedClassSummary?.name ?? editSummaryFallback?.className ?? displayNameFromCompendiumId(form.classId);
  const effectiveRaceName = raceDetail?.name ?? races.find((r) => r.id === form.raceId)?.name ?? editSummaryFallback?.species ?? displayNameFromCompendiumId(form.raceId);
  const effectiveHitDie =
    classDetail?.hd ??
    selectedClassSummary?.hd ??
    editSummaryFallback?.hitDie ??
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
  React.useEffect(() => { setClassFeatDetails({}); }, [form.classId]);

  // Load spell lists once classDetail is known
  // Load race detail when selected — also reset race choices
  React.useEffect(() => { setRaceFeatDetail(null); }, [form.raceId]);

  useCharacterCreatorFeatDetails({
    ruleset: form.ruleset,
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
    featSpellChoiceOptions: allFeatSpellChoiceOptions,
    growthChoiceDefinitions,
    growthOptionEntriesByKey,
    preparedSpellProgressionChoiceDefinitions,
    classInvocations,
    eligibleInvocationIds,
  });

  // Load bg detail when selected
  React.useEffect(() => { setBgOriginFeatDetail(null); }, [form.bgId]);

  // Auto-select directly-granted background feats (e.g. Charlatan → Skilled)
  React.useEffect(() => {
    if (!bgDetail) return;
    const prof = bgDetail.proficiencies;
    if (!prof || prof.featChoice > 0 || prof.feats.length === 0) {
      return;
    }
    const fixedFeatId = prof.feats[0]?.id;
    if (!fixedFeatId) return;
    setForm((f) => (f.chosenBgOriginFeatId === fixedFeatId ? f : { ...f, chosenBgOriginFeatId: fixedFeatId }));
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
    const options = parseStartingEquipmentOptions(bgDetail.equipmentOptions);
    if (options.length > 0) {
      setForm(f => f.chosenBgEquipmentOption ? f : { ...f, chosenBgEquipmentOption: options[0].id });
    }
  }, [bgDetail]);

  // Auto-select the first equipment option when classDetail loads
  React.useEffect(() => {
    if (!classDetail) return;
    const options = parseStartingEquipmentOptions(classDetail.equipmentOptions);
    if (options.length > 0) {
      setForm(f => f.chosenClassEquipmentOption ? f : { ...f, chosenClassEquipmentOption: options[0].id });
    }
  }, [classDetail]);

  const creatorResolvedScores = React.useMemo(() => {
    const raceAbilityBonuses = deriveRaceAbilityBonuses(
      raceDetail,
      raceDetail?.parsedChoices?.abilityScoreChoice,
      form,
    );
    return resolvedScores(form, selectedFeatAbilityBonuses, raceAbilityBonuses);
  }, [form, raceDetail, selectedFeatAbilityBonuses]);

  // Auto-calculate HP, AC, speed when class/race/scores change
  React.useEffect(() => {
    const hd = effectiveHitDie;
    const scores = creatorResolvedScores;
    const conMod = abilityMod(scores.con ?? 10);
    const hp = calcHpMax(hd, form.level, conMod);
    const baseSpeed = raceDetail?.speed ?? races.find((race) => race.id === form.raceId)?.speed ?? 30;
    const classFeatureEffects = parseAppliedClassFeatureEffects(classDetail, form.level, form.subclass, form.chosenOptionals);
    const speciesTraitEffects = parseAppliedSpeciesTraitEffects(raceDetail);
    const { ac, speed } = deriveCreatorSheetFacts({
      baseSpeed,
      level: form.level,
      scores,
      classFeatureEffects,
      speciesTraitEffects,
    });
    const hpStr = String(hp);
    const acStr = String(ac);
    const speedStr = String(speed);
    setForm((f) => (f.hpMax === hpStr && f.ac === acStr && f.speed === speedStr ? f : { ...f, hpMax: hpStr, ac: acStr, speed: speedStr }));
  }, [effectiveHitDie, effectiveClassName, classDetail, raceDetail, races, form, creatorResolvedScores, resolvedRaceFeatDetail?.name, resolvedBgOriginFeatDetail?.name, featSummaries, levelUpFeatDetails, bgDetail?.proficiencies?.feats, bgDetail?.traits]);

  // Trim cantrips/spells that no longer fit once the level field (creation or edit-time) drops --
  // unlike invocations and level-up feats, nothing else caps these against the *current* count/max
  // spell level, so a lowered level otherwise leaves the character over-provisioned.
  React.useEffect(() => {
    if (!classDetail) return;
    const cantripCount = getCantripCount(classDetail, form.level, form.subclass);
    const scores = creatorResolvedScores;
    const spellAbility = String(classDetail.spellAbility ?? "").toLowerCase();
    const prepCount = getPreparedSpellCount(classDetail, form.level, form.subclass, scores[spellAbility as keyof typeof scores]);
    const maxSpellLevel = getMaxSlotLevel(classDetail, form.level, form.subclass);
    const usesSpellbook = classDetail.autolevels.some((autolevel) =>
      (autolevel.level ?? 0) <= form.level && autolevel.features.some((feature) =>
        (feature.choices ?? []).some((choice) => choice.kind === "spell" && choice.mode === "spellbook"),
      ),
    );
    const classCantripIds = new Set(classCantrips.map((spell) => spell.id));
    const classSpellById = new Map(classSpells.map((spell) => [spell.id, spell]));
    // When there's more to trim than fits, drop the most-recently-acquired first instead of
    // whatever happens to be last in the array -- uses the *original* loaded character's tags
    // (editSummaryFallback, set once at hydration, not live-updated), so this reflects real
    // acquisition history rather than incidental array order. Anything not in that history (added
    // this editing session) sorts as form.level, i.e. "just learned" -- trimmed first if over cap.
    const existingSpellLevelById = new Map((editSummaryFallback?.existingSpells ?? []).map((entry) => [entry.id, entry.level ?? form.level]));
    const levelOf = (id: string) => existingSpellLevelById.get(id) ?? form.level;
    setForm((f) => {
      // Only drop entries for not-currently-available ids once classCantrips/classSpells have
      // actually loaded -- both start empty while their async fetch is in flight (kicked off by
      // a separate effect keyed on the same classDetail change), so filtering against them before
      // they resolve would misread "not loaded yet" as "not available" and wipe every real
      // cantrip/spell the character already has. Count-based trimming below doesn't have this
      // problem since it doesn't depend on the lists having loaded.
      const filteredCantrips = classCantrips.length > 0
        ? f.chosenCantrips.filter((id) => classCantripIds.has(id))
        : f.chosenCantrips;
      const nextCantrips = filteredCantrips.length > cantripCount
        ? [...filteredCantrips].sort((a, b) => levelOf(a) - levelOf(b)).slice(0, cantripCount)
        : filteredCantrips;
      const filteredSpells = classSpells.length > 0
        ? f.chosenSpells.filter((id) => {
            const spell = classSpellById.get(id);
            const level = Number(spell?.level ?? 0);
            return Boolean(spell) && level > 0 && level <= maxSpellLevel;
          })
        : f.chosenSpells;
      // A spellbook is accumulated knowledge, not the currently prepared list. Down-leveling may
      // remove spells learned above the target level, but must never truncate the remaining book
      // to the prepared-spell allowance.
      const nextSpells = trimAcquiredIdsForLevel(filteredSpells, levelOf, form.level, usesSpellbook ? null : prepCount);
      const sameArray = (a: string[], b: string[]) => a.length === b.length && a.every((id, index) => id === b[index]);
      if (sameArray(nextCantrips, f.chosenCantrips) && sameArray(nextSpells, f.chosenSpells)) return f;
      return { ...f, chosenCantrips: nextCantrips, chosenSpells: nextSpells };
    });
  }, [classDetail, classCantrips, classSpells, form, creatorResolvedScores, editSummaryFallback]);

  // Trim invocations down to the current level's count when it exceeds the allowance -- the
  // eligibility sanitizer (useCharacterCreatorSanitizers.ts) only drops entries that no longer
  // individually qualify, it doesn't cap by count, so a level-down could otherwise leave more
  // invocations selected than the new level allows even though each one still qualifies. Same
  // level-aware drop-most-recent-first logic as the cantrip/spell trim above.
  React.useEffect(() => {
    if (!classDetail) return;
    const invocTableForTrim = getClassFeatureTable(classDetail, "Invocation", form.level, form.subclass);
    const invocCountForTrim = invocTableForTrim.length > 0 ? tableValueAtLevel(invocTableForTrim, form.level) : 0;
    const existingInvocationLevelById = new Map((editSummaryFallback?.existingInvocations ?? []).map((entry) => [entry.id, entry.level ?? form.level]));
    const invocationLevelOf = (id: string) => existingInvocationLevelById.get(id) ?? form.level;
    setForm((f) => {
      if (f.chosenInvocations.length <= invocCountForTrim) return f;
      const nextInvocations = [...f.chosenInvocations].sort((a, b) => invocationLevelOf(a) - invocationLevelOf(b)).slice(0, invocCountForTrim);
      return { ...f, chosenInvocations: nextInvocations };
    });
  }, [classDetail, form, editSummaryFallback]);

  // Clear subclass / optional-group picks (Pact Boon, Fighting Style, etc.) once level drops below
  // the level that grants them -- mirrors the invocation-eligibility sanitizer above, so a
  // level-down can't leave subclass features active past what the level actually qualifies for.
  React.useEffect(() => {
    if (!classDetail) return;
    const subclassLevel = getSubclassLevel(classDetail);
    const needsSubclassClear = Boolean(form.subclass) && subclassLevel != null && form.level < subclassLevel;
    const validOptionalNames = new Set(
      getOptionalGroups(classDetail, form.level).flatMap((group) => group.features.flatMap((feature) => feature.selectionNames))
    );
    setForm((f) => {
      const nextSubclass = needsSubclassClear ? "" : f.subclass;
      const nextOptionals = f.chosenOptionals.filter((name) => validOptionalNames.has(name));
      if (nextSubclass === f.subclass && nextOptionals.length === f.chosenOptionals.length) return f;
      return { ...f, subclass: nextSubclass, chosenOptionals: nextOptionals };
    });
  }, [classDetail, form.level, form.subclass]);

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
    featSpellChoiceOptions: allFeatSpellChoiceOptions,
    growthOptionEntriesByKey,
    classCantrips,
    classSpells,
    classInvocations,
    isEditing,
    fallbackClassName: effectiveClassName || null,
    fallbackHitDie: effectiveHitDie,
    fallbackSpecies: effectiveRaceName || null,
    existingHpCurrent: editSummaryFallback?.hpCurrent ?? null,
    existingExtraFeatIds: editSummaryFallback?.extraFeatIds ?? [],
    existingInvocationFeatIds: editSummaryFallback?.invocationFeatIds ?? [],
    existingSpells: editSummaryFallback?.existingSpells ?? [],
    existingInvocations: editSummaryFallback?.existingInvocations ?? [],
    existingAcquisitionLevels: editSummaryFallback?.existingAcquisitionLevels ?? {},
    existingClasses: editSummaryFallback?.existingClasses ?? [],
    existingSelectedFeatureNames: editSummaryFallback?.existingSelectedFeatureNames ?? [],
    existingProficiencies: editSummaryFallback?.existingProficiencies ?? {},
    editId,
    portraitFile,
    initialCampaignIdsRef,
    classifyFeatSelection,
    navigate,
    setError,
  });

  const invocTable = classDetail ? getClassFeatureTable(classDetail, "Invocation", form.level, form.subclass) : [];
  const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, form.level) : 0;

  const handleSubmitWithChecks = React.useCallback(async () => {
    if (selectedFeatSpellcastingAbilityChoices.some((entry) => entry.chosen.length < entry.max)) {
      setError("Choose a spellcasting ability for each feat-granted spell before saving.");
      setStep(8);
      return;
    }
    if (!invocationGrantedFeatChoices.valid) {
      setError("Complete every choice for the Origin Feat granted by your Invocation before saving.");
      setStep(8);
      return;
    }
    if (invocCount > 0 && form.chosenInvocations.length < invocCount) {
      // A prerequisite check (Pact Boon, a damage cantrip, etc.) can silently drop a
      // previously-chosen invocation when the build changes elsewhere -- Eldritch Versatility's
      // own text requires replacing it, so block the save instead of leaving the slot empty.
      setError(`Choose ${invocCount - form.chosenInvocations.length} more Eldritch Invocation(s) before saving — a build change made a previous choice ineligible.`);
      setStep(8);
      return;
    }
    await handleSubmit();
  }, [form.chosenInvocations.length, handleSubmit, invocCount, invocationGrantedFeatChoices.valid, selectedFeatSpellcastingAbilityChoices]);

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
      invocationFeatChoices,
      invocationGrantedFeatChoices,
      featSpellChoiceOptions: allFeatSpellChoiceOptions,
      growthOptionEntriesByKey,
      items,
      campaigns,
      error,
      busy,
      isEditing,
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
        <StepHeader current={step} onStepClick={(s) => setStep(s as Step)} isEditing={isEditing} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 32, alignItems: "start" }}>
          <div>{main}</div>
          <div style={{ position: "sticky", top: 36 }}>{side}</div>
        </div>
      </div>
    </div>
  );
}
