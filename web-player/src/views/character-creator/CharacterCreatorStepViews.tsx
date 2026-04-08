import React from "react";
import { matchesRuleset, type Ruleset } from "@/lib/characterRules";
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  ALL_LANGUAGES,
  ALL_SKILLS,
  ALL_TOOLS,
  POINT_BUY_BUDGET,
  POINT_BUY_COSTS,
  STANDARD_ARRAY,
  WEAPON_MASTERY_KINDS,
} from "@/views/character-creator/constants/CharacterCreatorConstants";
import {
  abilityMod,
  extractClassStartingEquipment,
  featuresUpToLevelForSubclass,
  getCantripCount,
  getClassFeatureTable,
  getMaxSlotLevel,
  getPreparedSpellCount,
  getSubclassLevel,
  getSubclassList,
  isSpellcaster,
  parseRaceChoices,
  parseSkillList,
  parseStartingEquipmentOptions,
  tableValueAtLevel,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import { buildSpellStepChoiceState } from "@/views/character-creator/utils/CharacterCreatorSpellStepUtils";
import {
  getOptionalGroups,
  getPrimaryAbilityKeys,
  pointBuySpent,
  resolvedScores,
  type FormState,
  type Step,
} from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import type {
  BgDetail,
  BgSummary,
  Campaign,
  ClassDetail,
  ClassSummary,
  CreatorResolvedSpellChoiceEntry,
  CreatorSpellListChoiceEntry,
  ItemSummary,
  LevelUpFeatDetail,
  ProficiencyChoice,
  RaceDetail,
  RaceSummary,
  SpellSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import type { BackgroundFeat } from "@/views/character-creator/utils/FeatChoiceTypes";
import type { SharedSpellSummary } from "@/views/character-creator/utils/SpellChoiceUtils";
import type { SelectedFeatSpellcastingAbilityChoiceEntry } from "@/views/character-creator/utils/FeatSpellcastingUtils";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import type { ParseFeatureGrantsResult } from "@/views/character/CharacterRuleParsers";
import { renderClassStep, renderLevelStep, renderSpeciesStep, renderSpellsStep } from "@/views/character-creator/steps/CharacterCreatorStepPanels";
import { renderBackgroundStep } from "@/views/character-creator/steps/CharacterCreatorBackgroundStep";
import { renderAbilityScoresStep, renderDerivedStatsStep } from "@/views/character-creator/steps/CharacterCreatorPanelAdvancedSteps";
import { renderIdentityStep } from "@/views/character-creator/steps/CharacterCreatorPanelCoreSteps";
import { renderSkillsStep } from "@/views/character-creator/steps/CharacterCreatorSkillsStep";
import { renderCampaignsStep } from "@/views/character-creator/steps/CharacterCreatorStepPanels";
import { buildProficiencyMap as buildProficiencyMapFromUtils } from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";

type StepRenderResult = { main: React.ReactNode; side: React.ReactNode };

export type CharacterCreatorStepRenderContext = {
  step: Step;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  setStep: React.Dispatch<React.SetStateAction<Step>>;
  setField: (key: keyof FormState, value: FormState[keyof FormState]) => void;
  handleSubmit: () => Promise<void>;
  sideSummary: React.ReactNode;
  classDetail: ClassDetail | null;
  selectedRuleset: Ruleset;
  classes: ClassSummary[];
  classSearch: string;
  setClassSearch: React.Dispatch<React.SetStateAction<string>>;
  races: RaceSummary[];
  raceSearch: string;
  setRaceSearch: React.Dispatch<React.SetStateAction<string>>;
  raceDetail: RaceDetail | null;
  featSummaries: { id: string; name: string; ruleset?: Ruleset | null }[];
  raceFeatSearch: string;
  setRaceFeatSearch: React.Dispatch<React.SetStateAction<string>>;
  raceFeatDetail: BackgroundFeat | null;
  bgs: BgSummary[];
  bgSearch: string;
  setBgSearch: React.Dispatch<React.SetStateAction<string>>;
  bgDetail: BgDetail | null;
  bgOriginFeatSearch: string;
  setBgOriginFeatSearch: React.Dispatch<React.SetStateAction<string>>;
  bgOriginFeatDetail: BackgroundFeat | null;
  levelUpFeatDetails: LevelUpFeatDetail[];
  classFeatDetails: Record<string, BackgroundFeat>;
  classCantrips: SpellSummary[];
  classSpells: SpellSummary[];
  classInvocations: SpellSummary[];
  featSpellChoiceOptions: Record<string, SharedSpellSummary[]>;
  growthOptionEntriesByKey: Record<string, Array<{ id: string; name: string; rarity?: string | null; type?: string | null; magic?: boolean; attunement?: boolean }>>;
  items: ItemSummary[];
  campaigns: Campaign[];
  error: string | null;
  busy: boolean;
  isEditing: boolean;
  parseFeatureGrants: (text: string) => ParseFeatureGrantsResult;
  getStep5ChoiceState: any;
  step5SkillList: string[];
  step5NumSkills: number;
  step5BgLangChoice: { fixed: string[]; choose: number; from: string[] | null };
  step5CoreLanguageChoice: ProficiencyChoice | null;
  step5ClassFeatChoices: any[];
  step5ClassLanguageChoice: ProficiencyChoice | null;
  step5ClassExpertiseChoices: any[];
  step5WeaponMasteryChoice: { count: number; source: string } | null;
  step5WeaponOptions: string[];
  step5ChoiceState: any;
  step6SpellListChoices: CreatorSpellListChoiceEntry[];
  step6ResolvedSpellChoices: CreatorResolvedSpellChoiceEntry[];
  selectedFeatSpellcastingAbilityChoices: SelectedFeatSpellcastingAbilityChoiceEntry[];
  selectedClassFeatureProficiencyChoices: Array<{ id: string; source: { name: string }; choice?: { optionCategory?: string; count: { kind: string; value: number } } }>;
  selectedFeatGrantedAbilityBonuses: Record<string, number>;
  selectedFeatAbilityBonuses: Record<string, number>;
  levelUpFeatLevels: number[];
  availableLevelUpFeats: { id: string; name: string }[];
  levelUpFeatConflict: string | null;
  getClassFeatChoiceLabel: (featGroup: string) => string;
  getClassFeatOptionLabel: (optionName: string, featGroup: string) => string;
  eligibleInvocationIds: Set<string>;
  growthChoiceDefinitions: any[];
  preparedSpellProgressionChoiceDefinitions: any[];
  getGrowthChoiceSelectedAbility: (choices: Record<string, string[]>, definition: any) => string | null;
  portraitInputRef: React.RefObject<HTMLInputElement | null>;
  portraitPreview: string | null;
  setPortraitFile: React.Dispatch<React.SetStateAction<File | null>>;
  setPortraitPreview: React.Dispatch<React.SetStateAction<string | null>>;
};

function renderClass(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  return renderClassStep({
    classes: ctx.classes,
    classSearch: ctx.classSearch,
    setClassSearch: ctx.setClassSearch,
    form: ctx.form,
    onSelectClass: (classId) => ctx.setForm((f) => ({
      ...f,
      classId,
      ruleset: "5.5e",
      raceId: "",
      bgId: "",
      chosenRaceSkills: [],
      chosenRaceLanguages: [],
      chosenRaceTools: [],
      chosenRaceFeatId: null,
      chosenRaceSize: null,
      chosenBgSkills: [],
      chosenBgOriginFeatId: null,
      chosenBgTools: [],
      chosenBgLanguages: [],
      chosenBgEquipmentOption: null,
      chosenFeatOptions: {},
      chosenFeatureChoices: {},
      bgAbilityMode: "split",
      bgAbilityBonuses: {},
    })),
    onNext: () => ctx.setStep(2),
    classDetail: ctx.classDetail,
    abilityLabels: ABILITY_LABELS,
  });
}

function renderSpecies(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const availableRaces = ctx.races.filter((r) => matchesRuleset(r, ctx.selectedRuleset));
  const filtered = ctx.raceSearch
    ? availableRaces.filter((r) => r.name.toLowerCase().includes(ctx.raceSearch.toLowerCase()))
    : availableRaces;

  function toggleRacePick<K extends "chosenRaceSkills" | "chosenRaceLanguages" | "chosenRaceTools">(
    key: K,
    item: string,
    max: number,
  ) {
    ctx.setForm((f) => {
      const cur = f[key] as string[];
      const sel = cur.includes(item);
      return {
        ...f,
        [key]: sel ? cur.filter((x) => x !== item) : cur.length < max ? [...cur, item] : cur,
      };
    });
  }

  const raceChoices = ctx.raceDetail ? (ctx.raceDetail.parsedChoices ?? parseRaceChoices(ctx.raceDetail.traits)) : null;
  const originFeats = ctx.featSummaries.filter((f) => /\borigin\b/i.test(f.name) && matchesRuleset(f, ctx.selectedRuleset));
  const filteredFeats = ctx.raceFeatSearch
    ? originFeats.filter((f) => f.name.toLowerCase().includes(ctx.raceFeatSearch.toLowerCase()))
    : originFeats;

  return renderSpeciesStep({
    availableRaces,
    filteredRaces: filtered,
    raceSearch: ctx.raceSearch,
    setRaceSearch: ctx.setRaceSearch,
    selectedRaceId: ctx.form.raceId,
    selectRace: (id) => ctx.setField("raceId", id),
    raceDetail: ctx.raceDetail,
    raceChoices,
    chosenRaceSize: ctx.form.chosenRaceSize,
    selectRaceSize: (size) => ctx.setForm((f) => ({ ...f, chosenRaceSize: size })),
    chosenRaceSkills: ctx.form.chosenRaceSkills,
    chosenRaceTools: ctx.form.chosenRaceTools,
    chosenRaceLanguages: ctx.form.chosenRaceLanguages,
    toggleRacePick,
    allSkills: ALL_SKILLS.map((skill) => skill.name),
    allTools: ALL_TOOLS,
    allLanguages: ALL_LANGUAGES,
    raceFeatSearch: ctx.raceFeatSearch,
    setRaceFeatSearch: ctx.setRaceFeatSearch,
    filteredFeats,
    chosenRaceFeatId: ctx.form.chosenRaceFeatId,
    selectRaceFeat: (id, selected) => ctx.setForm((f) => ({
      ...f,
      chosenRaceFeatId: selected ? null : id,
      chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("race:"))),
    })),
    raceFeatDetail: ctx.raceFeatDetail,
    onBack: () => ctx.setStep(1),
    onNext: () => ctx.setStep(3),
  });
}

function renderBackground(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const availableBackgrounds = ctx.bgs.filter((b) => matchesRuleset(b, ctx.selectedRuleset));
  const filtered = ctx.bgSearch
    ? availableBackgrounds.filter((b) => b.name.toLowerCase().includes(ctx.bgSearch.toLowerCase()))
    : availableBackgrounds;
  const equipmentOptions = parseStartingEquipmentOptions(ctx.bgDetail?.equipment);
  const originFeats = ctx.featSummaries.filter((f) => /\borigin\b/i.test(f.name) && matchesRuleset(f, ctx.selectedRuleset));
  const filteredBgFeats = ctx.bgOriginFeatSearch
    ? originFeats.filter((f) => f.name.toLowerCase().includes(ctx.bgOriginFeatSearch.toLowerCase()))
    : originFeats;

  return renderBackgroundStep({
    availableBackgrounds,
    filteredBackgrounds: filtered,
    bgSearch: ctx.bgSearch,
    setBgSearch: ctx.setBgSearch,
    form: ctx.form,
    setForm: ctx.setForm,
    selectBackground: (id) => ctx.setField("bgId", id),
    bgDetail: ctx.bgDetail,
    bgOriginFeatSearch: ctx.bgOriginFeatSearch,
    setBgOriginFeatSearch: ctx.setBgOriginFeatSearch,
    filteredBgFeats,
    equipmentOptions,
    onBack: () => ctx.setStep(2),
    onNext: () => ctx.setStep(4),
    step: ctx.step,
  });
}

function renderAbilityScores(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const usedIndices = Object.values(ctx.form.standardAssign).filter((v) => v >= 0);
  const spent = pointBuySpent(ctx.form.pbScores);
  const remaining = POINT_BUY_BUDGET - spent;
  const primaryKeys = getPrimaryAbilityKeys(ctx.classDetail);
  const bgBonuses = ctx.form.bgAbilityBonuses;
  const hasBgBonuses = Object.keys(bgBonuses).length > 0;

  return renderAbilityScoresStep({
    form: ctx.form,
    setAbilityMethod: (method) => ctx.setField("abilityMethod", method),
    setStandardAssign: (key, idx) => ctx.setForm((f) => ({ ...f, standardAssign: { ...f.standardAssign, [key]: idx } })),
    setPointBuyScore: (key, score) => ctx.setForm((f) => ({ ...f, pbScores: { ...f.pbScores, [key]: score } })),
    usedIndices,
    remaining,
    primaryKeys,
    bgBonuses,
    hasBgBonuses,
    backgroundName: ctx.bgDetail?.name,
    abilityLabels: ABILITY_LABELS,
    abilityKeys: ABILITY_KEYS,
    standardArray: STANDARD_ARRAY,
    pointBuyBudget: POINT_BUY_BUDGET,
    pointBuyCosts: POINT_BUY_COSTS,
    abilityMod,
    onBack: () => ctx.setStep(3),
    onNext: () => ctx.setStep(5),
    side: ctx.sideSummary,
  });
}

function renderLevel(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const subclassList = ctx.classDetail ? getSubclassList(ctx.classDetail) : [];
  const scNeeded = ctx.classDetail ? (getSubclassLevel(ctx.classDetail) ?? 99) : 99;
  const showSubclass = Boolean(ctx.classDetail && ctx.form.level >= scNeeded && subclassList.length > 0);
  const features = ctx.classDetail ? featuresUpToLevelForSubclass(ctx.classDetail, ctx.form.level, ctx.form.subclass) : [];
  const optGroups = ctx.classDetail
    ? getOptionalGroups(ctx.classDetail, ctx.form.level)
        .map((group) => ({
          ...group,
          features: group.features.filter((feature) => !/ability score improvement/i.test(feature.name.trim())),
        }))
        .filter((group) => group.features.length > 0)
    : [];
  const classEquipmentText = extractClassStartingEquipment(ctx.classDetail);
  const classEquipmentOptions = parseStartingEquipmentOptions(classEquipmentText);
  const scoresBeforeLevelUpAsi = resolvedScores(ctx.form, ctx.selectedFeatGrantedAbilityBonuses);
  const levelUpScores = ctx.levelUpFeatLevels.reduce<Record<number, Record<string, number>>>((acc, level) => {
    const previousLevel = ctx.levelUpFeatLevels.filter((candidate) => candidate < level).sort((a, b) => a - b).pop();
    const previousScores = previousLevel != null ? acc[previousLevel] : scoresBeforeLevelUpAsi;
    const nextScores = { ...previousScores };
    const previousEntry = previousLevel != null ? ctx.form.chosenLevelUpFeats.find((entry) => entry.level === previousLevel) : null;
    if (previousEntry?.type === "asi") {
      for (const [ability, bonus] of Object.entries(previousEntry.abilityBonuses ?? {})) {
        nextScores[ability] = Math.min(20, (nextScores[ability] ?? 10) + bonus);
      }
    }
    acc[level] = nextScores;
    return acc;
  }, {});
  const levelUpFeatChoices = ctx.levelUpFeatLevels.map((level) => ({
    level,
    mode: ctx.form.chosenLevelUpFeats.find((entry) => entry.level === level)?.type ?? null,
    selectedFeatId: ctx.form.chosenLevelUpFeats.find((entry) => entry.level === level)?.featId ?? null,
    asiBonuses: ctx.form.chosenLevelUpFeats.find((entry) => entry.level === level)?.abilityBonuses ?? {},
    options: ctx.availableLevelUpFeats.map((feat) => ({ id: feat.id, name: feat.name })),
  }));

  function toggleOptional(name: string, exclusive: boolean, groupFeatures: string[]) {
    ctx.setForm((f) => {
      let next = [...f.chosenOptionals];
      if (exclusive) {
        next = next.filter((n) => !groupFeatures.includes(n));
        if (!f.chosenOptionals.includes(name)) next.push(name);
      } else {
        next = next.includes(name) ? next.filter((n) => n !== name) : [...next, name];
      }
      return { ...f, chosenOptionals: next };
    });
  }

  return renderLevelStep({
    level: ctx.form.level,
    setLevel: (level) => ctx.setField("level", level),
    subclass: ctx.form.subclass,
    setSubclass: (value) => ctx.setField("subclass", value),
    showSubclass,
    subclassList,
    optGroups,
    chosenOptionals: ctx.form.chosenOptionals,
    toggleOptional,
    parseFeatureGrants: ctx.parseFeatureGrants,
    classEquipmentText,
    classEquipmentOptions,
    chosenClassEquipmentOption: ctx.form.chosenClassEquipmentOption,
    chooseClassEquipmentOption: (id) => ctx.setForm((f) => ({ ...f, chosenClassEquipmentOption: id })),
    className: ctx.classDetail?.name ?? null,
    features,
    levelUpFeatChoices,
    levelUpScores,
    toggleLevelUpChoiceMode: (level, mode) => ctx.setForm((f) => ({
      ...f,
      chosenLevelUpFeats: [
        ...f.chosenLevelUpFeats.filter((entry) => entry.level !== level),
        { level, type: mode, featId: null, abilityBonuses: {} },
      ].sort((a, b) => a.level - b.level),
      chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([key]) => !key.startsWith(`levelupfeat:${level}:`))),
    })),
    toggleLevelUpAsiPoint: (level, ability) => ctx.setForm((f) => {
      const existing = f.chosenLevelUpFeats.find((entry) => entry.level === level);
      const bonuses = { ...(existing?.abilityBonuses ?? {}) };
      const assigned = Object.values(bonuses).reduce((sum, value) => sum + value, 0);
      const current = bonuses[ability] ?? 0;
      if (current >= 2) bonuses[ability] = current - 1;
      else if (current > 0 && assigned >= 2) {
        if (current === 1) delete bonuses[ability];
        else bonuses[ability] = current - 1;
      } else if (assigned < 2) bonuses[ability] = current + 1;
      return {
        ...f,
        chosenLevelUpFeats: [
          ...f.chosenLevelUpFeats.filter((entry) => entry.level !== level),
          { level, type: "asi", featId: null, abilityBonuses: bonuses },
        ].sort((a, b) => a.level - b.level),
      };
    }),
    chooseLevelUpFeat: (level, featId) => ctx.setForm((f) => ({
      ...f,
      chosenLevelUpFeats: [
        ...f.chosenLevelUpFeats.filter((entry) => entry.level !== level),
        { level, type: "feat", featId: featId || null, abilityBonuses: {} },
      ].sort((a, b) => a.level - b.level),
      chosenFeatOptions: featId
        ? f.chosenFeatOptions
        : Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([key]) => !key.startsWith(`levelupfeat:${level}:`))),
    })),
    levelUpFeatConflict: ctx.levelUpFeatConflict,
    onBack: () => ctx.setStep(4),
    onNext: () => ctx.setStep(6),
  });
}

function renderSkills(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  return renderSkillsStep({
    form: ctx.form,
    setForm: ctx.setForm,
    classDetailName: ctx.classDetail?.name ?? null,
    bgDetailName: ctx.bgDetail?.name ?? null,
    skillList: ctx.step5SkillList,
    numSkills: ctx.step5NumSkills,
    bgLangChoice: ctx.step5BgLangChoice,
    coreLanguageChoice: ctx.step5CoreLanguageChoice,
    classLanguageChoice: ctx.step5ClassLanguageChoice,
    classFeatChoices: ctx.step5ClassFeatChoices,
    classExpertiseChoices: ctx.step5ClassExpertiseChoices,
    classSelectedFeatChoices: ctx.step5ChoiceState.classSelectedFeatChoices,
    selectedClassFeatEntries: ctx.step5ChoiceState.selectedClassFeatEntries,
    bgFeatChoices: ctx.step5ChoiceState.bgFeatChoices,
    raceFeatChoices: ctx.step5ChoiceState.raceFeatChoices,
    classFeatureProficiencyChoices: ctx.selectedClassFeatureProficiencyChoices.map((choice) => ({
      key: `classfeature:${choice.id}`,
      sourceLabel: choice.source.name,
      category: choice.choice?.optionCategory as "skill" | "tool" | "language",
      count: choice.choice?.count.kind === "fixed" ? choice.choice.count.value : 0,
    })).filter((choice) => choice.count > 0),
    weaponMasteryChoice: ctx.step5WeaponMasteryChoice,
    weaponOptions: ctx.step5WeaponOptions,
    chosenFeatureChoices: ctx.form.chosenFeatureChoices,
    setChosenFeatureChoices: (updater) =>
      ctx.setForm((prev) => ({
        ...prev,
        chosenFeatureChoices: typeof updater === "function" ? updater(prev.chosenFeatureChoices) : updater,
      })),
    choiceState: {
      missingClassFeatChoices: ctx.step5ChoiceState.missingClassFeatChoices,
      missingClassExpertiseChoices: ctx.step5ChoiceState.missingClassExpertiseChoices,
      missingFeatOptionSelections: ctx.step5ChoiceState.missingFeatOptionSelections,
      missingCoreLanguages: ctx.step5ChoiceState.missingCoreLanguages,
      missingClassLanguages: ctx.step5ChoiceState.missingClassLanguages,
      missingWeaponMasteries: ctx.step5ChoiceState.missingWeaponMasteries,
      hasAnything: ctx.step5ChoiceState.hasAnything,
      takenSkillKeys: ctx.step5ChoiceState.takenSkillKeys,
      takenToolKeys: ctx.step5ChoiceState.takenToolKeys,
      takenLanguageKeys: ctx.step5ChoiceState.takenLanguageKeys,
      takenExpertiseKeys: ctx.step5ChoiceState.takenExpertiseKeys,
    },
    getClassFeatChoiceLabel: ctx.getClassFeatChoiceLabel,
    getClassFeatOptionLabel: ctx.getClassFeatOptionLabel,
    sideSummary: ctx.sideSummary,
    onBack: () => ctx.setStep(5),
    onNext: () => ctx.setStep(7),
  });
}

function renderSpells(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const cantripCount = ctx.classDetail ? getCantripCount(ctx.classDetail, ctx.form.level, ctx.form.subclass) : 0;
  const maxSlotLvl = ctx.classDetail ? getMaxSlotLevel(ctx.classDetail, ctx.form.level, ctx.form.subclass) : 0;
  const isCaster = ctx.classDetail ? isSpellcaster(ctx.classDetail, ctx.form.level, ctx.form.subclass) : false;
  const invocTable = ctx.classDetail ? getClassFeatureTable(ctx.classDetail, "Invocation", 1, ctx.form.subclass) : [];
  const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, ctx.form.level) : 0;
  const prepCount = ctx.classDetail ? getPreparedSpellCount(ctx.classDetail, ctx.form.level, ctx.form.subclass) : 0;
  const {
    extraSpellListChoices,
    extraSpellChoices,
    maneuverSpellChoices,
    planItemChoices,
    maneuverAbilityChoices,
    progressionTableChoices,
    missingExtraSpellSelections,
    } = buildSpellStepChoiceState({
      form: ctx.form,
      setForm: ctx.setForm,
      step6SpellListChoices: ctx.step6SpellListChoices,
      step6ResolvedSpellChoices: ctx.step6ResolvedSpellChoices,
      growthChoiceDefinitions: ctx.growthChoiceDefinitions,
      preparedSpellProgressionChoiceDefinitions: ctx.preparedSpellProgressionChoiceDefinitions,
      growthOptionEntriesByKey: ctx.growthOptionEntriesByKey,
    featSpellChoiceOptions: ctx.featSpellChoiceOptions,
    getGrowthChoiceSelectedAbility: ctx.getGrowthChoiceSelectedAbility,
  });

  const featSpellcastingAbilityChoices = ctx.selectedFeatSpellcastingAbilityChoices.map((entry) => ({
    ...entry,
    onToggle: (value: string) =>
      ctx.setForm((prev) => {
        const current = prev.chosenFeatOptions[entry.key] ?? [];
        const next = current.includes(value)
          ? current.filter((selected) => selected !== value)
          : current.length < entry.max
            ? [...current, value]
            : current;
        return {
          ...prev,
          chosenFeatOptions: {
            ...prev.chosenFeatOptions,
            [entry.key]: next,
          },
        };
      }),
  }));
  const missingSpellcastingAbilitySelections = featSpellcastingAbilityChoices.some((entry) => entry.chosen.length < entry.max);

  function toggleSpell(id: string, listKey: "chosenCantrips" | "chosenSpells" | "chosenInvocations", max: number) {
    ctx.setForm((f) => {
      const current = f[listKey];
      const next = current.includes(id) ? current.filter((x) => x !== id) : current.length < max ? [...current, id] : current;
      return { ...f, [listKey]: next };
    });
  }

  return renderSpellsStep({
    isCaster,
    cantripCount,
    classCantrips: ctx.classCantrips,
    chosenCantrips: ctx.form.chosenCantrips,
    toggleCantrip: (id) => toggleSpell(id, "chosenCantrips", cantripCount),
    invocCount,
    classInvocations: ctx.classInvocations.filter((inv) => ctx.eligibleInvocationIds.has(inv.id)),
    chosenInvocations: ctx.form.chosenInvocations,
    toggleInvocation: (id) => toggleSpell(id, "chosenInvocations", invocCount),
    invocationAllowed: (inv) => ctx.eligibleInvocationIds.has(inv.id),
    prepCount,
    maxSlotLevel: maxSlotLvl,
    classSpells: ctx.classSpells,
    chosenSpells: ctx.form.chosenSpells,
    toggleSpell: (id) => toggleSpell(id, "chosenSpells", prepCount),
    extraSpellListChoices,
    extraSpellChoices: [...extraSpellChoices, ...maneuverSpellChoices],
    extraChoiceGroups: [...featSpellcastingAbilityChoices, ...maneuverAbilityChoices, ...progressionTableChoices],
    extraItemChoices: planItemChoices,
    onBack: () => ctx.setStep(6),
    onNext: () => ctx.setStep(8),
    nextDisabled: missingExtraSpellSelections || missingSpellcastingAbilitySelections,
    side: ctx.sideSummary,
  });
}

function renderDerivedStats(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  const scores = resolvedScores(ctx.form, ctx.selectedFeatAbilityBonuses);
  const conMod = abilityMod(scores.con ?? 10);
  const dexMod = abilityMod(scores.dex ?? 10);
  const hd = ctx.classDetail?.hd ?? 8;
  const prof: ProficiencyMap = buildProficiencyMapFromUtils({
    form: ctx.form,
    classDetail: ctx.classDetail,
    raceDetail: ctx.raceDetail,
    bgDetail: ctx.bgDetail,
    classCantrips: ctx.classCantrips,
    classSpells: ctx.classSpells,
    classInvocations: ctx.classInvocations,
    bgOriginFeatDetail: ctx.bgOriginFeatDetail,
    raceFeatDetail: ctx.raceFeatDetail,
    classFeatDetails: ctx.classFeatDetails,
    levelUpFeatDetails: ctx.levelUpFeatDetails,
    spellChoiceOptionsByKey: ctx.featSpellChoiceOptions,
    itemChoiceOptionsByKey: ctx.growthOptionEntriesByKey,
  });
  const sections = [
    { label: "Skills", items: prof.skills },
    { label: "Expertise", items: prof.expertise },
    { label: "Saves", items: prof.saves },
    { label: "Armor", items: prof.armor },
    { label: "Weapons", items: prof.weapons },
    { label: "Tools", items: prof.tools },
    { label: "Languages", items: prof.languages },
    { label: "Maneuvers", items: prof.maneuvers },
    { label: "Magic Item Plans", items: prof.plans },
    { label: "Spells", items: prof.spells },
    { label: "Invocations", items: prof.invocations },
  ].filter((s) => s.items.length > 0);

  return renderDerivedStatsStep({
    level: ctx.form.level,
    hpMax: ctx.form.hpMax,
    ac: ctx.form.ac,
    speed: ctx.form.speed,
    setField: (key, value) => ctx.setField(key as keyof FormState, value as never),
    hd,
    conMod,
    dexMod,
    raceSpeed: ctx.raceDetail?.speed ?? 30,
    sections,
    onBack: () => ctx.setStep(7),
    onNext: () => ctx.setStep(9),
    side: ctx.sideSummary,
  });
}

function renderIdentity(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  return renderIdentityStep({
    form: ctx.form as unknown as Record<string, unknown> & { [key: string]: unknown },
    setField: (key, value) => ctx.setField(key as keyof FormState, value as never),
    portraitInputRef: ctx.portraitInputRef,
    portraitPreview: ctx.portraitPreview,
    setPortraitFile: ctx.setPortraitFile,
    setPortraitPreview: ctx.setPortraitPreview,
    onBack: () => ctx.setStep(8),
    onNext: () => ctx.setStep(10),
    side: ctx.sideSummary,
  });
}

function renderCampaigns(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  return renderCampaignsStep({
    campaigns: ctx.campaigns,
    selectedCampaignIds: ctx.form.campaignIds,
    toggleCampaign: (id, checked) => ctx.setForm((f) => ({
      ...f,
      campaignIds: checked ? [...f.campaignIds, id] : f.campaignIds.filter((campaignId) => campaignId !== id),
    })),
    error: ctx.error,
    busy: ctx.busy,
    isEditing: ctx.isEditing,
    onBack: () => ctx.setStep(9),
    onSubmit: ctx.handleSubmit,
    side: ctx.sideSummary,
  });
}

export function renderCharacterCreatorStep(ctx: CharacterCreatorStepRenderContext): StepRenderResult {
  switch (ctx.step) {
    case 1: return renderClass(ctx);
    case 2: return renderSpecies(ctx);
    case 3: return renderBackground(ctx);
    case 4: return renderAbilityScores(ctx);
    case 5: return renderLevel(ctx);
    case 6: return renderSkills(ctx);
    case 7: return renderSpells(ctx);
    case 8: return renderDerivedStats(ctx);
    case 9: return renderIdentity(ctx);
    case 10: return renderCampaigns(ctx);
    default: return { main: null, side: null };
  }
}
