import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { C } from "@/lib/theme";
import {
  matchesRuleset,
  type Ruleset,
} from "@/lib/characterRules";
import { api, jsonInit } from "@/services/api";
import { createMyCharacter } from "@/services/actorApi";
import { useAuth } from "@/contexts/AuthContext";
import {
  invocationPrerequisitesMet,
  normalizeSpellTrackingKey,
  spellLooksLikeDamageSpell,
} from "@/views/character/CharacterSheetUtils";
import {
  getClassLanguageChoice as getClassLanguageChoiceFromRules,
  getCoreLanguageChoice as getCoreLanguageChoiceFromRules,
  parseFeatureGrants as parseFeatureGrantsFromRules,
} from "@/views/character/CharacterRuleParsers";
import {
  collectProficiencyChoiceEffectsFromEffects,
  collectSpellChoicesFromEffects,
  parseFeatureEffects,
  type ParseFeatureEffectsInput,
} from "@/domain/character/parseFeatureEffects";
import { buildAppliedCharacterFeatures, buildPreparedSpellProgressionChoiceDefinitions } from "@/domain/character/characterFeatures";
import {
  ABILITY_NAME_TO_KEY,
  ABILITY_SCORE_NAMES,
  ALL_LANGUAGES,
  MUSICAL_INSTRUMENTS,
  STANDARD_55E_LANGUAGES,
  WEAPON_MASTERY_KINDS,
  WEAPON_MASTERY_KIND_SET,
} from "@/views/character-creator/constants/CharacterCreatorConstants";
import {
  abilityMod,
  abilityNamesToKeys,
  calcHpMax,
  classifyFeatSelection,
  extractClassStartingEquipment,
  getClassExpertiseChoices,
  getFeatureSubclassName,
  getPreparedSpellCount,
  getSpellcastingClassName,
  getSlotLevelTriggeredSpellChoicesUpToLevel,
  normalizeChoiceKey,
  parseSkillList,
  parseStartingEquipmentOptions,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  buildItemLookupBodyFromNames,
  fetchCompendiumItemsByLookup,
  isItemLookupBodyEmpty,
} from "@/views/character-creator/utils/ItemLookupUtils";
import {
  getGrowthChoiceDefinitions,
  getGrowthChoiceSelectedAbility,
  sanitizeGrowthChoiceSelections,
} from "@/views/character-creator/utils/GrowthChoiceUtils";
import {
  buildSelectedFeatSpellcastingAbilityChoices,
} from "@/views/character-creator/utils/FeatSpellcastingUtils";
import { buildSpellStepChoiceState, buildStep6SpellListChoices, buildStep6ResolvedSpellChoices } from "@/views/character-creator/utils/CharacterCreatorSpellStepUtils";
import {
  buildSpellListChoiceEntry,
  buildResolvedSpellChoiceEntry,
  resolveSelectedSpellOptionEntries,
  sanitizeSpellChoiceSelections,
} from "@/views/character-creator/utils/SpellChoiceUtils";
import type {
  ParsedFeatChoiceLike as ParsedFeatChoice,
  ParsedFeatLike as ParsedFeat,
  ParsedFeatDetailLike as BackgroundFeat,
} from "@/views/character-creator/utils/FeatChoiceTypes";
import type {
  BgDetail,
  BgSummary,
  Campaign,
  ClassDetail,
  ClassFeatChoice,
  ClassSummary,
  CreatorResolvedSpellChoiceEntry,
  CreatorSpellListChoiceEntry,
  LevelUpFeatDetail,
  LevelUpFeatSelection,
  ProficiencyChoice,
  RaceDetail,
  RaceSummary,
  SpellSummary,
  StructuredBgProficiencies,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import { Select } from "@/ui/Select";
import { titleCase } from "@/lib/format/titleCase";
import { NavButtons, SpellPicker, StepHeader } from "@/views/character-creator/shared/CharacterCreatorParts";
import { CharacterCreatorSideSummary } from "@/views/character-creator/shared/CharacterCreatorSideSummary";
import {
  detailBoxStyle,
  headingStyle,
  inputStyle,
  labelStyle,
  profChipStyle,
  smallBtnStyle,
  sourceTagStyle,
  statLabelStyle,
  statValueStyle,
} from "@/views/character-creator/shared/CharacterCreatorStyles";
import { getStep5ChoiceState, getFeatChoiceOptionsForStep5 } from "@/views/character-creator/utils/CharacterCreatorStep5Utils";
import {
  buildProficiencyMap as buildProficiencyMapFromUtils,
  parseAppliedClassFeatureEffects,
  buildStartingInventory as buildStartingInventoryFromUtils,
  getWeaponMasteryChoice as getWeaponMasteryChoiceFromUtils,
} from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";
import {
  collectEquipmentLookupNames,
  getBackgroundGrantedToolSelections as getBackgroundGrantedToolSelectionsFromUtils,
} from "@/views/character-creator/utils/CharacterCreatorEquipmentUtils";
import {
  deriveFeatGrantedAbilityBonuses,
  deriveTotalFeatAbilityBonuses,
  getClassFeatChoiceLabel,
  getClassFeatChoices,
  getClassFeatOptionLabel,
  getOptionalGroups,
  getPrimaryAbilityKeys,
  getSelectedAbilityIncrease,
  initForm,
  isToughFeat,
  pointBuySpent,
  resolvedScores,
  type FormState,
  type Step,
} from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type { CharacterData, ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import { renderCharacterCreatorStep, type CharacterCreatorStepRenderContext } from "@/views/character-creator/CharacterCreatorStepViews";
import { renderIdentityStep } from "@/views/character-creator/steps/CharacterCreatorPanelCoreSteps";
import { useCreatorCompendiumCatalogs } from "@/views/character-creator/useCreatorCompendiumCatalogs";
import { useCreatorEditHydration } from "@/views/character-creator/useCreatorEditHydration";
import { useCreatorChoiceData } from "@/views/character-creator/useCreatorChoiceData";
import { buildCreatorSubmissionBody } from "@/views/character-creator/creatorSubmission";


// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function CharacterCreatorView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const isEditing = Boolean(editId);

  const [step, setStep] = React.useState<Step>(1);
  const [form, setForm] = React.useState<FormState>(() => initForm(user, searchParams));
  const [busy, setBusy] = React.useState(false);
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
  const prevRaceIdRef = React.useRef<string | null>(null);
  const prevBgIdRef = React.useRef<string | null>(null);

  // Portrait selection (not part of form schema — uploaded separately after save)
  const [portraitFile, setPortraitFile] = React.useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = React.useState<string | null>(null);
  const portraitInputRef = React.useRef<HTMLInputElement>(null);

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
  const selectedClassSummary = React.useMemo(
    () => classes.find((c) => c.id === form.classId) ?? null,
    [classes, form.classId]
  );
  const selectedRuleset: Ruleset = "5.5e";
  const selectedClassFeatDetails = React.useMemo(
    () => Object.entries(form.chosenClassFeatIds)
      .map(([featureName]) => classFeatDetails[featureName])
      .filter(Boolean),
    [form.chosenClassFeatIds, classFeatDetails]
  );
  const selectedClassFeatureEffects = React.useMemo(
    () => parseAppliedClassFeatureEffects(classDetail, form.level, form.subclass, form.chosenOptionals),
    [classDetail, form.level, form.subclass, form.chosenOptionals]
  );
  const selectedClassFeatureSpellChoices = React.useMemo(
    () => collectSpellChoicesFromEffects(selectedClassFeatureEffects)
      .filter((choice) => !/^(level\s+\d+:\s+)?(spellcasting|pact magic)\b/i.test(choice.source.name)),
    [selectedClassFeatureEffects]
  );
  const selectedClassFeatureProficiencyChoices = React.useMemo(
    () => collectProficiencyChoiceEffectsFromEffects(selectedClassFeatureEffects)
      .filter((choice) =>
        !choice.expertise
        && choice.choice?.count.kind === "fixed"
        && ["skill", "tool", "language"].includes(choice.choice?.optionCategory ?? "")
      ),
    [selectedClassFeatureEffects]
  );
  const selectedInvocationEffects = React.useMemo(
    () => classInvocations
      .filter((invocation) => form.chosenInvocations.includes(invocation.id) && String(invocation.text ?? "").trim())
      .map((invocation) => parseFeatureEffects({
        source: {
          id: `creator-invocation:${invocation.id}`,
          kind: "invocation",
          name: invocation.name,
          parentName: classDetail?.name ?? selectedClassSummary?.name ?? null,
          text: invocation.text ?? "",
        },
        text: invocation.text ?? "",
      } satisfies ParseFeatureEffectsInput)),
    [classDetail?.name, classInvocations, form.chosenInvocations, selectedClassSummary?.name]
  );
  const selectedInvocationSpellChoices = React.useMemo(
    () => collectSpellChoicesFromEffects(selectedInvocationEffects),
    [selectedInvocationEffects]
  );
  const selectedFeatGrantedAbilityBonuses = React.useMemo(() => {
    return deriveFeatGrantedAbilityBonuses({
      bgOriginFeatDetail: resolvedBgOriginFeatDetail,
      raceFeatDetail: resolvedRaceFeatDetail,
      classFeatDetails,
      levelUpFeatDetails,
      chosenFeatOptions: form.chosenFeatOptions,
    });
  }, [resolvedBgOriginFeatDetail, resolvedRaceFeatDetail, classFeatDetails, form.chosenFeatOptions, levelUpFeatDetails]);
  const selectedFeatAbilityBonuses = React.useMemo(() => {
    return deriveTotalFeatAbilityBonuses(selectedFeatGrantedAbilityBonuses, form.chosenLevelUpFeats);
  }, [form.chosenLevelUpFeats, selectedFeatGrantedAbilityBonuses]);
  const step5SkillList = classDetail ? parseSkillList(classDetail.proficiency) : [];
  const step5NumSkills = classDetail?.numSkills ?? 0;
  const step5BgLangChoice = bgDetail?.proficiencies?.languages ?? { fixed: [], choose: 0, from: null };
  const step5BgSkillFixed = bgDetail?.proficiencies?.skills?.fixed ?? (bgDetail ? parseSkillList(bgDetail.proficiency) : []);
  const step5BgToolFixed = bgDetail?.proficiencies?.tools?.fixed ?? [];
  const step5CoreLanguageChoice = getCoreLanguageChoiceFromRules(raceDetail, STANDARD_55E_LANGUAGES);
  const step5ClassFeatChoices = getClassFeatChoices(classDetail, form.level, featSummaries, selectedRuleset);
  const step5ClassLanguageChoice = getClassLanguageChoiceFromRules(classDetail, form.level, ALL_LANGUAGES);
  const step5ClassExpertiseChoices = getClassExpertiseChoices(classDetail, form.level);
  const step5WeaponMasteryChoice = getWeaponMasteryChoiceFromUtils(classDetail, form.level);
  const step5WeaponOptions = React.useMemo(() => [...WEAPON_MASTERY_KINDS].sort((a, b) => a.localeCompare(b)), []);
  const step5ChoiceState = React.useMemo(() => getStep5ChoiceState({
    form,
    bgDetail,
    raceDetailName: raceDetail?.name,
    bgOriginFeatDetail: resolvedBgOriginFeatDetail,
    bgSkillFixed: step5BgSkillFixed,
    bgToolFixed: step5BgToolFixed,
    classFeatChoices: step5ClassFeatChoices,
    classFeatDetails,
    raceFeatDetail: resolvedRaceFeatDetail,
    levelUpFeatDetails,
    classLanguageChoice: step5ClassLanguageChoice,
    coreLanguageChoice: step5CoreLanguageChoice,
    classExpertiseChoices: step5ClassExpertiseChoices,
    weaponMasteryChoice: step5WeaponMasteryChoice,
    weaponOptions: step5WeaponOptions,
  }), [
    classFeatDetails,
    form,
    bgDetail,
    levelUpFeatDetails,
    raceDetail?.name,
    resolvedBgOriginFeatDetail,
    resolvedRaceFeatDetail,
    step5BgSkillFixed,
    step5BgToolFixed,
    step5ClassExpertiseChoices,
    step5ClassFeatChoices,
    step5ClassLanguageChoice,
    step5CoreLanguageChoice,
    step5WeaponMasteryChoice,
    step5WeaponOptions,
  ]);
  const step6FeatSpellListChoices = React.useMemo<CreatorSpellListChoiceEntry[]>(
    () => step5ChoiceState.allFeatChoices
      .filter(({ choice }) => choice.type === "spell_list")
      .map(({ featName, choice, key, sourceLabel }) => {
        const resolvedSourceLabel = sourceLabel ?? featName;
        const entry = buildSpellListChoiceEntry({
          key,
          choice: { ...choice, options: getFeatChoiceOptionsForStep5(choice) },
          level: form.level,
          sourceLabel: resolvedSourceLabel,
        });
        return {
          ...entry,
          title: "Spell List",
          note: entry.options.length === 1 && resolvedSourceLabel !== featName
            ? (choice.note ?? "Spell list fixed by this feat.")
            : choice.note,
        };
      }),
    [form.level, step5ChoiceState]
  );
  const step6FeatResolvedSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => step5ChoiceState.allFeatChoices
      .filter(({ choice }) => choice.type === "spell")
      .map(({ featName, choice, key, sourceLabel }) => {
        const resolvedSourceLabel = sourceLabel ?? featName;
        const linkedChoiceKey = choice.linkedTo ? key.replace(`:${choice.id}`, `:${choice.linkedTo}`) : null;
        return {
          ...buildResolvedSpellChoiceEntry({
            key,
            choice,
            level: form.level,
            sourceLabel: resolvedSourceLabel,
            chosenOptions: form.chosenFeatOptions,
            linkedChoiceKey,
          }),
        };
      }),
    [form.chosenFeatOptions, form.level, step5ChoiceState]
  );
  const step6ClassFeatureSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => selectedClassFeatureSpellChoices.flatMap((effect) => {
      if (effect.count.kind !== "fixed") return [];
      return [{
        key: `classfeature:${effect.id}`,
        title: effect.level === 0 ? "Bonus Cantrip" : `Bonus Level ${effect.level} Spell`,
        sourceLabel: effect.source.name,
        count: effect.count.value,
        level: effect.level,
        note: effect.summary,
        listNames: effect.spellLists,
      }];
    }),
    [selectedClassFeatureSpellChoices]
  );
  const step6InvocationSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => selectedInvocationSpellChoices.flatMap((effect) => {
      if (effect.count.kind !== "fixed") return [];
      return [{
        key: `invocation:${effect.id}`,
        title: effect.level === 0 ? "Invocation Bonus Cantrip" : `Invocation Bonus Level ${effect.level} Spell`,
        sourceLabel: effect.source.name,
        count: effect.count.value,
        level: effect.level,
        note: effect.note ?? effect.summary,
        listNames: effect.spellLists,
        schools: effect.schools,
        ritualOnly: /\britual tag\b/i.test(effect.note ?? ""),
      }];
    }),
    [selectedInvocationSpellChoices]
  );
  const step6SlotGrowthSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => getSlotLevelTriggeredSpellChoicesUpToLevel(
      classDetail,
      form.level,
      form.subclass || null,
    ).map((choice) => ({
      key: `creator:${choice.key}`,
      title: choice.title,
      sourceLabel: choice.sourceLabel,
      count: choice.count,
      level: choice.level,
      note: choice.note ?? null,
      listNames: choice.listNames,
      schools: choice.schools,
      ritualOnly: false,
    })),
    [classDetail, form.level, form.subclass]
  );
  const step6SpellListChoices = step6FeatSpellListChoices;
  const step6ResolvedSpellChoices = React.useMemo(
    () => [
      ...step6FeatResolvedSpellChoices,
      ...step6ClassFeatureSpellChoices,
      ...step6InvocationSpellChoices,
      ...step6SlotGrowthSpellChoices,
    ],
    [step6ClassFeatureSpellChoices, step6FeatResolvedSpellChoices, step6InvocationSpellChoices, step6SlotGrowthSpellChoices]
  );
  const selectedFeatSpellcastingAbilityChoices = React.useMemo(
    () => buildSelectedFeatSpellcastingAbilityChoices({
      selectedChoices: form.chosenFeatOptions,
      bgOriginFeatDetail: resolvedBgOriginFeatDetail,
      raceFeatDetail: resolvedRaceFeatDetail,
      classFeatDetails,
      levelUpFeatDetails,
    }),
    [classFeatDetails, form.chosenFeatOptions, levelUpFeatDetails, resolvedBgOriginFeatDetail, resolvedRaceFeatDetail]
  );
  const growthChoiceDefinitions = React.useMemo(
    () => getGrowthChoiceDefinitions({
      classId: form.classId,
      className: classDetail?.name ?? selectedClassSummary?.name ?? null,
      classDetail,
      level: form.level,
      selectedSubclass: form.subclass ?? null,
    }),
    [classDetail, form.classId, form.level, form.subclass, selectedClassSummary?.name]
  );
  const { featSpellChoiceOptions, growthOptionEntriesByKey, items } = useCreatorChoiceData({
    step6ResolvedSpellChoices,
    growthChoiceDefinitions,
  });
  const preparedSpellProgressionChoiceDefinitions = React.useMemo(
    () => buildPreparedSpellProgressionChoiceDefinitions(buildAppliedCharacterFeatures({
      charData: {
        classes: form.classId || selectedClassSummary?.name ? [{
          id: `class_${form.classId || "primary"}`,
          classId: form.classId || null,
          className: selectedClassSummary?.name ?? null,
          level: form.level,
          subclass: form.subclass || null,
        }] : [],
        chosenOptionals: form.chosenOptionals,
      },
      characterLevel: form.level,
      classDetail,
      raceDetail,
      backgroundDetail: bgDetail,
      bgOriginFeatDetail: resolvedBgOriginFeatDetail,
      raceFeatDetail: resolvedRaceFeatDetail,
      classFeatDetails: Object.entries(form.chosenClassFeatIds)
        .map(([featureName]) => classFeatDetails[featureName])
        .filter(Boolean),
      levelUpFeatDetails,
      invocationDetails: [],
    })),
    [bgDetail, resolvedBgOriginFeatDetail, classDetail, classFeatDetails, form.chosenClassFeatIds, form.chosenOptionals, form.level, form.subclass, levelUpFeatDetails, raceDetail, resolvedRaceFeatDetail]
  );
  const levelUpFeatLevels = React.useMemo(
    () => Array.from(new Set((classDetail?.autolevels ?? [])
      .filter((al) => al.scoreImprovement && al.level != null && al.level <= form.level)
      .map((al) => al.level)))
      .sort((a, b) => a - b),
    [classDetail, form.level]
  );
  const availableLevelUpFeats = React.useMemo(
    () => featSummaries.filter((feat) => (form.level >= 19 || !/^boon of\b/i.test(feat.name)) && matchesRuleset(feat, selectedRuleset)),
    [featSummaries, form.level]
  );
  const levelUpFeatConflict = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of form.chosenLevelUpFeats) {
      if (!entry?.featId) continue;
      counts.set(entry.featId, (counts.get(entry.featId) ?? 0) + 1);
    }
    for (const [featId, count] of counts.entries()) {
      if (count < 2) continue;
      const detail = levelUpFeatDetails.find((entry) => entry.featId === featId)?.feat;
      if (!detail?.parsed.repeatable) return `Duplicate feat selected: ${featId}`;
    }
    return null;
  }, [form.chosenLevelUpFeats, levelUpFeatDetails]);

  // Load compendium lists on mount

  useCreatorEditHydration({
    editId,
    setForm,
    setEditLoading,
    initialCampaignIdsRef,
  });

  // Load class detail when selected
  React.useEffect(() => {
    if (!form.classId) { setClassDetail(null); setClassFeatDetails({}); return; }
    setForm((f) => ({
      ...f,
      chosenClassFeatIds: {},
      chosenClassLanguages: [],
      chosenClassEquipmentOption: null,
      chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("classfeat:"))),
    }));
    setClassFeatDetails({});
    api<ClassDetail>(`/api/compendium/classes/${form.classId}`).then(setClassDetail).catch(() => {});
  }, [form.classId]);

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

  const eligibleInvocationIds = React.useMemo(() => {
    const chosenCantripNames = classCantrips
      .filter((spell) => form.chosenCantrips.includes(spell.id))
      .map((spell) => spell.name);
    const chosenDamageCantripNames = classCantrips
      .filter((spell) => form.chosenCantrips.includes(spell.id) && spellLooksLikeDamageSpell(spell))
      .map((spell) => spell.name);
    const chosenInvocationNames = classInvocations
      .filter((invocation) => form.chosenInvocations.includes(invocation.id))
      .map((invocation) => invocation.name);

    return new Set(
      classInvocations
        .filter((invocation) =>
          invocationPrerequisitesMet(invocation.text ?? "", {
            level: form.level,
            chosenCantripNames,
            chosenDamageCantripNames,
            chosenInvocationNames,
          })
        )
        .map((invocation) => invocation.id)
    );
  }, [classCantrips, classInvocations, form.chosenCantrips, form.chosenInvocations, form.level]);

  // Drop any chosen invocations whose prerequisites are no longer met
  React.useEffect(() => {
    if (classInvocations.length === 0) return;
    setForm((f) => {
      const next = f.chosenInvocations.filter((id) => eligibleInvocationIds.has(id));
      if (next.length === f.chosenInvocations.length) return f;
      return { ...f, chosenInvocations: next };
    });
  }, [classInvocations, eligibleInvocationIds]);

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
    api<RaceDetail>(`/api/compendium/races/${form.raceId}`).then(setRaceDetail).catch(() => {});
  }, [form.raceId, isEditing]);

  React.useEffect(() => {
    const raceFeatId = typeof form.chosenRaceFeatId === "string" ? form.chosenRaceFeatId.trim() : "";
    const bgFeatId = typeof form.chosenBgOriginFeatId === "string" ? form.chosenBgOriginFeatId.trim() : "";
    const classFeatEntries = Object.entries(form.chosenClassFeatIds).filter(
      ([, featId]) => typeof featId === "string" && featId.trim().length > 0,
    ) as [string, string][];
    const levelUpFeatEntries = form.chosenLevelUpFeats.filter(
      (entry): entry is { level: number; featId: string } =>
        typeof entry?.level === "number"
        && typeof entry?.featId === "string"
        && entry.featId.trim().length > 0,
    );
    const ids = Array.from(
      new Set(
        [
          raceFeatId,
          bgFeatId,
          ...classFeatEntries.map(([, featId]) => featId.trim()),
          ...levelUpFeatEntries.map((entry) => entry.featId.trim()),
        ].filter(Boolean),
      ),
    );

    if (ids.length === 0) {
      setRaceFeatDetail(null);
      setBgOriginFeatDetail(null);
      setClassFeatDetails({});
      setLevelUpFeatDetails([]);
      return;
    }

    let cancelled = false;
    api<{ rows: Array<{ id: string; feat: ({ name: string; text?: string; parsed: ParsedFeat } & Record<string, unknown>) | null }> }>(
      "/api/compendium/feats/lookup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      },
    )
      .then((payload) => {
        if (cancelled) return;
        const detailById = new Map<string, { id: string; name: string; text?: string; parsed: ParsedFeat }>();
        for (const row of payload.rows ?? []) {
          if (!row?.id || !row?.feat) continue;
          detailById.set(String(row.id), {
            id: String(row.id),
            name: String(row.feat.name ?? ""),
            text: typeof row.feat.text === "string" ? row.feat.text : undefined,
            parsed: row.feat.parsed as ParsedFeat,
          });
        }

        setFeatDetailCache((prev) => {
          const next = { ...prev };
          for (const [featId, detail] of detailById.entries()) next[featId] = detail;
          return next;
        });

        setRaceFeatDetail(raceFeatId ? detailById.get(raceFeatId) ?? null : null);
        setBgOriginFeatDetail(bgFeatId ? detailById.get(bgFeatId) ?? null : null);
        setClassFeatDetails(
          Object.fromEntries(
            classFeatEntries.flatMap(([featureName, featId]) => {
              const detail = detailById.get(featId);
              return detail ? [[featureName, detail] as const] : [];
            }),
          ),
        );
        setLevelUpFeatDetails(
          levelUpFeatEntries.flatMap(({ level, featId }) => {
            const detail = detailById.get(featId);
            return detail ? [{ level, featId, feat: detail } satisfies LevelUpFeatDetail] : [];
          }),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setRaceFeatDetail(null);
        setBgOriginFeatDetail(null);
        setClassFeatDetails({});
        setLevelUpFeatDetails([]);
      });

    return () => { cancelled = true; };
  }, [form.chosenBgOriginFeatId, form.chosenClassFeatIds, form.chosenLevelUpFeats, form.chosenRaceFeatId]);

  React.useEffect(() => {
    setForm((f) => {
      const allowedLevels = new Set(levelUpFeatLevels);
      const nextChosenLevelUpFeats = f.chosenLevelUpFeats.filter((entry) => allowedLevels.has(entry.level));
      const nextChosenFeatOptions = Object.fromEntries(
        Object.entries(f.chosenFeatOptions).filter(([key]) => {
          const match = key.match(/^levelupfeat:(\d+):/);
          return !match || allowedLevels.has(Number(match[1]));
        })
      );
      if (nextChosenLevelUpFeats.length === f.chosenLevelUpFeats.length && Object.keys(nextChosenFeatOptions).length === Object.keys(f.chosenFeatOptions).length) {
        return f;
      }
      return {
        ...f,
        chosenLevelUpFeats: nextChosenLevelUpFeats,
        chosenFeatOptions: nextChosenFeatOptions,
      };
    });
  }, [levelUpFeatLevels]);

  React.useEffect(() => {
    const allSpellChoiceKeys = new Set<string>([
      ...step6SpellListChoices.map((choice) => choice.key),
      ...step6ResolvedSpellChoices.map((choice) => choice.key),
    ]);
    if (allSpellChoiceKeys.size === 0) return;
    setForm((f) => {
      const nextChosenFeatOptions = sanitizeSpellChoiceSelections({
        currentSelections: f.chosenFeatOptions,
        spellListChoices: step6SpellListChoices,
        resolvedSpellChoices: step6ResolvedSpellChoices,
        spellOptionsByKey: featSpellChoiceOptions,
      });
      const changed = Object.keys(nextChosenFeatOptions).length !== Object.keys(f.chosenFeatOptions).length
        || Object.entries(nextChosenFeatOptions).some(([key, values]) => {
          const current = f.chosenFeatOptions[key] ?? [];
          return values.length !== current.length || values.some((value, index) => value !== current[index]);
        });
      return changed ? { ...f, chosenFeatOptions: nextChosenFeatOptions } : f;
    });
  }, [featSpellChoiceOptions, step6ResolvedSpellChoices, step6SpellListChoices]);

  React.useEffect(() => {
    if (growthChoiceDefinitions.length === 0) return;
    setForm((f) => {
      const nextChosenFeatureChoices = sanitizeGrowthChoiceSelections({
        definitions: growthChoiceDefinitions,
        currentSelections: f.chosenFeatureChoices,
        optionEntriesByKey: growthOptionEntriesByKey,
      });
      const changed = Object.keys(nextChosenFeatureChoices).length !== Object.keys(f.chosenFeatureChoices).length
        || Object.entries(nextChosenFeatureChoices).some(([key, values]) => {
          const current = f.chosenFeatureChoices[key] ?? [];
          return values.length !== current.length || values.some((value, index) => value !== current[index]);
        });
      return changed ? { ...f, chosenFeatureChoices: nextChosenFeatureChoices } : f;
    });
  }, [growthChoiceDefinitions, growthOptionEntriesByKey]);

  React.useEffect(() => {
    if (preparedSpellProgressionChoiceDefinitions.length === 0) return;
    setForm((f) => {
      const nextSelections = { ...f.chosenFeatureChoices };
      const validKeys = new Set(preparedSpellProgressionChoiceDefinitions.map((definition) => definition.key));
      for (const definition of preparedSpellProgressionChoiceDefinitions) {
        const filtered = (nextSelections[definition.key] ?? [])
          .filter((value) => definition.options.includes(value))
          .slice(0, 1);
        if (filtered.length > 0) nextSelections[definition.key] = filtered;
        else delete nextSelections[definition.key];
      }
      for (const key of Object.keys(nextSelections)) {
        if (key.includes(":prepared-spell-progression:") && !validKeys.has(key)) delete nextSelections[key];
      }
      const changed = Object.keys(nextSelections).length !== Object.keys(f.chosenFeatureChoices).length
        || Object.entries(nextSelections).some(([key, values]) => {
          const current = f.chosenFeatureChoices[key] ?? [];
          return values.length !== current.length || values.some((value, index) => value !== current[index]);
        });
      return changed ? { ...f, chosenFeatureChoices: nextSelections } : f;
    });
  }, [preparedSpellProgressionChoiceDefinitions]);

  // Load bg detail when selected
  React.useEffect(() => {
    if (!form.bgId) { setBgDetail(null); return; }
    const prevBgId = prevBgIdRef.current;
    prevBgIdRef.current = form.bgId;
    const shouldResetBgChoices = !isEditing || (prevBgId !== null && prevBgId !== form.bgId);
    setBgOriginFeatDetail(null);
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
    api<BgDetail>(`/api/compendium/backgrounds/${form.bgId}`).then(setBgDetail).catch(() => {});
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
    const options = parseStartingEquipmentOptions(bgDetail.equipment);
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
    const hd = classDetail?.hd ?? 8;
    const scores = resolvedScores(form, selectedFeatAbilityBonuses);
    const conMod = abilityMod(scores.con ?? 10);
    const dexMod = abilityMod(scores.dex ?? 10);
    const selectedBgFeatName = resolvedBgOriginFeatDetail?.name
      ?? featSummaries.find((feat) => feat.id === form.chosenBgOriginFeatId)?.name
      ?? null;
    const hasTough =
      isToughFeat(resolvedRaceFeatDetail?.name)
      || isToughFeat(selectedBgFeatName)
      || selectedClassFeatDetails.some((feat) => isToughFeat(feat.name))
      || levelUpFeatDetails.some(({ feat }) => isToughFeat(feat.name));
    const hp = calcHpMax(hd, form.level, conMod) + (hasTough ? form.level * 2 : 0);
    const ac = 10 + dexMod;
    const baseSpeed = raceDetail?.speed ?? 30;
    setForm((f) => ({ ...f, hpMax: String(hp), ac: String(ac), speed: String(baseSpeed) }));
  }, [classDetail, raceDetail, form.level, form.abilityMethod, form.standardAssign, form.pbScores, form.bgAbilityBonuses, resolvedRaceFeatDetail?.name, resolvedBgOriginFeatDetail?.name, form.chosenBgOriginFeatId, featSummaries, selectedClassFeatDetails, selectedFeatAbilityBonuses, levelUpFeatDetails]);

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function optionalText(value: string | undefined) {
    return (value ?? "").trim();
  }

  async function handleSubmit() {
    if (!form.characterName.trim()) { setError("Character name is required."); return; }
    if (selectedFeatSpellcastingAbilityChoices.some((entry) => entry.chosen.length < entry.max)) {
      setError("Choose a spellcasting ability for each feat-granted spell before saving.");
      setStep(7);
      return;
    }
    setBusy(true); setError(null);
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

      // In edit mode: unassign any campaigns the user removed
      if (isEditing) {
        const removed = initialCampaignIdsRef.current.filter(
          (id) => !form.campaignIds.includes(id)
        );
        for (const campaignId of removed) {
          await api(`/api/me/characters/${charId}/unassign`, jsonInit("POST", { campaignId }));
        }
      }

      // Assign / sync all currently selected campaigns
      if (form.campaignIds.length > 0) {
        await api(`/api/me/characters/${charId}/assign`, jsonInit("POST", { campaignIds: form.campaignIds }));
      }

      // Upload portrait if one was selected
      if (portraitFile) {
        const fd = new FormData();
        fd.append("image", portraitFile);
        await api(`/api/me/characters/${charId}/image`, { method: "POST", body: fd });
      }

      navigate("/");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save character.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step renderers ──────────────────────────────────────────────────────────

  function renderStep(): { main: React.ReactNode; side: React.ReactNode } {
    return renderCharacterCreatorStep({
      step,
      form,
      setForm,
      setStep,
      setField: set,
      handleSubmit,
      sideSummary,
      classDetail,
      selectedRuleset,
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
    />
  );

  // Step 9: Identity
  function StepIdentity(): { main: React.ReactNode; side: React.ReactNode } {
    return renderIdentityStep({
      form: form as unknown as Record<string, unknown> & { [key: string]: unknown },
      setField: (key, value) => set(key as keyof FormState, value as never),
      portraitInputRef,
      portraitPreview,
      setPortraitFile,
      setPortraitPreview,
      onBack: () => setStep(8),
      onNext: () => setStep(10),
      side: sideSummary,
    });
  }

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

