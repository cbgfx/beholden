import { ALL_LANGUAGES, ALL_SKILLS, ALL_TOOLS } from "../constants/CharacterCreatorConstants";
import { getFeatChoiceOptions, normalizeChoiceKey } from "./CharacterCreatorUtils";
import type { ParsedFeatChoiceLike as Step5FeatChoiceLike, ParsedFeatLike as Step5ParsedFeatLike, ParsedFeatDetailLike as Step5BackgroundFeatLike } from "./FeatChoiceTypes";
import { getFeatSpellcastingAbilityChoice } from "./FeatSpellcastingUtils";

export type { Step5FeatChoiceLike, Step5ParsedFeatLike, Step5BackgroundFeatLike };

export interface Step5ClassFeatChoiceLike {
  featureName: string;
  featGroup: string;
  options: Array<{ id: string; name: string }>;
}

export interface Step5ClassExpertiseChoiceLike {
  key: string;
  source: string;
  count: number;
  options: string[] | null;
}

export interface Step5WeaponMasteryChoiceLike {
  source: string;
  count: number;
}

export interface Step5LanguageChoiceLike {
  fixed: string[];
  choose: number;
  from: string[] | null;
  source?: string;
}

export interface Step5FormLike {
  chosenSkills: string[];
  chosenRaceSkills: string[];
  chosenRaceTools: string[];
  chosenRaceLanguages: string[];
  chosenBgTools: string[];
  chosenBgLanguages: string[];
  chosenClassLanguages: string[];
  chosenClassFeatIds: Record<string, string>;
  chosenFeatOptions: Record<string, string[]>;
  chosenWeaponMasteries: string[];
}

export interface Step5EntryWithChoice {
  featName: string;
  feat: Step5ParsedFeatLike;
  choice: Step5FeatChoiceLike;
  key: string;
  sourceLabel?: string;
}

export interface Step5ChoiceStateArgs {
  form: Step5FormLike;
  bgDetail: { name?: string | null; proficiencies?: { languages?: Step5LanguageChoiceLike } } | null;
  raceDetailName?: string | null;
  bgOriginFeatDetail?: Step5BackgroundFeatLike | null;
  bgSkillFixed: string[];
  bgToolFixed: string[];
  classFeatChoices: Step5ClassFeatChoiceLike[];
  classFeatDetails: Record<string, Step5BackgroundFeatLike>;
  raceFeatDetail: Step5BackgroundFeatLike | null;
  levelUpFeatDetails: Array<{ level: number; featId: string; feat: Step5BackgroundFeatLike }>;
  classLanguageChoice: Step5LanguageChoiceLike | null;
  coreLanguageChoice: Step5LanguageChoiceLike | null;
  classExpertiseChoices: Step5ClassExpertiseChoiceLike[];
  weaponMasteryChoice: Step5WeaponMasteryChoiceLike | null;
  weaponOptions: string[];
}

export interface Step5ChoiceState {
  bgFeatChoices: Step5EntryWithChoice[];
  raceFeatChoices: Step5EntryWithChoice[];
  selectedClassFeatEntries: Array<{ choice: Step5ClassFeatChoiceLike; detail: Step5BackgroundFeatLike }>;
  classSelectedFeatChoices: Step5EntryWithChoice[];
  allFeatChoices: Step5EntryWithChoice[];
  missingClassFeatChoices: boolean;
  missingClassExpertiseChoices: boolean;
  missingFeatOptionSelections: boolean;
  missingCoreLanguages: boolean;
  missingClassLanguages: boolean;
  missingWeaponMasteries: boolean;
  hasAnything: boolean;
  takenSkillKeys: Set<string>;
  takenToolKeys: Set<string>;
  takenLanguageKeys: Set<string>;
  takenExpertiseKeys: Set<string>;
}

function buildFeatChoiceEntries(
  detail: Step5BackgroundFeatLike,
  keyPrefix: string,
  sourceLabel?: string,
): Step5EntryWithChoice[] {
  const filtered = detail.parsed.choices
    .filter((choice) =>
      choice.type === "proficiency" ||
      choice.type === "weapon_mastery" ||
      choice.type === "expertise" ||
      choice.type === "ability_score" ||
      choice.type === "spell" ||
      choice.type === "spell_list"
    )
    .map((choice) => ({
      featName: detail.name,
      feat: detail.parsed as Step5ParsedFeatLike,
      choice,
      key: `${keyPrefix}:${choice.id}`,
      sourceLabel,
    }));

  const abilityChoice = getFeatSpellcastingAbilityChoice(detail) as Step5FeatChoiceLike | null;
  if (!abilityChoice) return filtered;
  if (filtered.some((entry) => entry.choice.id === abilityChoice.id)) return filtered;
  return [
    ...filtered,
    {
      featName: detail.name,
      feat: detail.parsed as Step5ParsedFeatLike,
      choice: abilityChoice,
      key: `${keyPrefix}:${abilityChoice.id}`,
      sourceLabel,
    },
  ];
}

function selectedFeatOptionsMatching(
  chosenFeatOptions: Record<string, string[]>,
  choices: Step5EntryWithChoice[],
  kind: "skill" | "tool" | "language"
): string[] {
  const matcher =
    kind === "skill"
      ? (value: string) => ALL_SKILLS.some((skill) => normalizeChoiceKey(skill) === normalizeChoiceKey(value))
      : kind === "tool"
        ? (value: string) => ALL_TOOLS.some((tool) => normalizeChoiceKey(tool) === normalizeChoiceKey(value))
        : (value: string) => ALL_LANGUAGES.some((language) => normalizeChoiceKey(language) === normalizeChoiceKey(value));

  return choices.flatMap(({ key }) => (chosenFeatOptions[key] ?? []).filter(matcher));
}

export function duplicateLockedForStep5(
  kind: "skill" | "tool" | "language" | "expertise",
  value: string,
  selected: boolean,
  taken: Pick<Step5ChoiceState, "takenSkillKeys" | "takenToolKeys" | "takenLanguageKeys" | "takenExpertiseKeys">
): boolean {
  if (selected) return false;
  const key = normalizeChoiceKey(value);
  if (kind === "skill") return taken.takenSkillKeys.has(key);
  if (kind === "tool") return taken.takenToolKeys.has(key);
  if (kind === "expertise") return taken.takenExpertiseKeys.has(key) || !taken.takenSkillKeys.has(key);
  return taken.takenLanguageKeys.has(key);
}

export function getStep5ChoiceState(args: Step5ChoiceStateArgs): Step5ChoiceState {
  const {
    form,
    bgDetail,
    bgOriginFeatDetail,
    bgSkillFixed,
    bgToolFixed,
    classFeatChoices,
    classFeatDetails,
    raceFeatDetail,
    levelUpFeatDetails,
    classLanguageChoice,
    coreLanguageChoice,
    classExpertiseChoices,
    weaponMasteryChoice,
    weaponOptions,
  } = args;

  const selectedClassFeatEntries = classFeatChoices
    .map((choice) => {
      const featId = form.chosenClassFeatIds[choice.featureName];
      if (!featId) return null;
      const detail = classFeatDetails[choice.featureName];
      if (!detail) return null;
      return { choice, detail };
    })
    .filter(Boolean) as Array<{ choice: Step5ClassFeatChoiceLike; detail: Step5BackgroundFeatLike }>;

  const classSelectedFeatChoices = selectedClassFeatEntries.flatMap(({ choice, detail }) =>
    buildFeatChoiceEntries(detail, `classfeat:${choice.featureName}`, choice.featureName)
  );

  const bgOriginFeatChoices: Step5EntryWithChoice[] = bgOriginFeatDetail
    ? buildFeatChoiceEntries(bgOriginFeatDetail, `bg:${bgOriginFeatDetail.name}`)
    : [];
  const backgroundFixedFeatChoices = (bgDetail?.proficiencies?.feats ?? []).flatMap((feat) =>
    buildFeatChoiceEntries(feat as Step5BackgroundFeatLike, `bg:${feat.name}`, bgDetail?.name ?? undefined)
  );
  const bgFeatChoices = [
    ...backgroundFixedFeatChoices,
    ...bgOriginFeatChoices,
  ];
  const raceFeatChoices: Step5EntryWithChoice[] = raceFeatDetail
    ? buildFeatChoiceEntries(raceFeatDetail, `race:${raceFeatDetail.name}`)
    : [];
  const levelUpFeatChoices: Step5EntryWithChoice[] = levelUpFeatDetails.flatMap(({ level, featId, feat }) =>
    buildFeatChoiceEntries(feat, `levelupfeat:${level}:${featId}`, `Level ${level}`)
  );

  const chosenBgFeatSkills = selectedFeatOptionsMatching(form.chosenFeatOptions, bgFeatChoices, "skill");
  const chosenBgFeatTools = selectedFeatOptionsMatching(form.chosenFeatOptions, bgFeatChoices, "tool");
  const chosenBgFeatLanguages = selectedFeatOptionsMatching(form.chosenFeatOptions, bgFeatChoices, "language");
  const chosenRaceFeatSkills = selectedFeatOptionsMatching(form.chosenFeatOptions, raceFeatChoices, "skill");
  const chosenRaceFeatTools = selectedFeatOptionsMatching(form.chosenFeatOptions, raceFeatChoices, "tool");
  const chosenRaceFeatLanguages = selectedFeatOptionsMatching(form.chosenFeatOptions, raceFeatChoices, "language");
  const chosenClassFeatSkills = selectedFeatOptionsMatching(form.chosenFeatOptions, classSelectedFeatChoices, "skill");
  const chosenClassFeatTools = selectedFeatOptionsMatching(form.chosenFeatOptions, classSelectedFeatChoices, "tool");
  const chosenClassFeatLanguages = selectedFeatOptionsMatching(form.chosenFeatOptions, classSelectedFeatChoices, "language");
  const chosenLevelUpFeatSkills = selectedFeatOptionsMatching(form.chosenFeatOptions, levelUpFeatChoices, "skill");
  const chosenLevelUpFeatTools = selectedFeatOptionsMatching(form.chosenFeatOptions, levelUpFeatChoices, "tool");
  const chosenLevelUpFeatLanguages = selectedFeatOptionsMatching(form.chosenFeatOptions, levelUpFeatChoices, "language");

  const takenSkillKeys = new Set<string>(
    [
      ...form.chosenSkills,
      ...form.chosenRaceSkills,
      ...bgSkillFixed,
      ...chosenBgFeatSkills,
      ...chosenRaceFeatSkills,
      ...chosenClassFeatSkills,
      ...chosenLevelUpFeatSkills,
    ].map(normalizeChoiceKey)
  );
  const takenToolKeys = new Set<string>(
    [
      ...form.chosenRaceTools,
      ...bgToolFixed,
      ...form.chosenBgTools,
      ...chosenBgFeatTools,
      ...chosenRaceFeatTools,
      ...chosenClassFeatTools,
      ...chosenLevelUpFeatTools,
    ].map(normalizeChoiceKey)
  );
  const takenLanguageKeys = new Set<string>(
    [
      ...(bgDetail?.proficiencies?.languages?.fixed ?? []),
      ...form.chosenBgLanguages,
      ...(classLanguageChoice?.fixed ?? []),
      ...form.chosenClassLanguages,
      ...(coreLanguageChoice?.fixed ?? []),
      ...form.chosenRaceLanguages,
      ...chosenBgFeatLanguages,
      ...chosenRaceFeatLanguages,
      ...chosenClassFeatLanguages,
      ...chosenLevelUpFeatLanguages,
    ].map(normalizeChoiceKey)
  );
  const takenExpertiseKeys = new Set<string>(
    [
      ...classExpertiseChoices.flatMap((choice) => form.chosenFeatOptions[choice.key] ?? []),
      ...bgFeatChoices.flatMap(({ key, choice }) => (choice.type === "expertise" ? (form.chosenFeatOptions[key] ?? []) : [])),
      ...raceFeatChoices.flatMap(({ key, choice }) => (choice.type === "expertise" ? (form.chosenFeatOptions[key] ?? []) : [])),
      ...classSelectedFeatChoices.flatMap(({ key, choice }) => (choice.type === "expertise" ? (form.chosenFeatOptions[key] ?? []) : [])),
      ...levelUpFeatChoices.flatMap(({ key, choice }) => (choice.type === "expertise" ? (form.chosenFeatOptions[key] ?? []) : [])),
    ].map(normalizeChoiceKey)
  );

  const missingClassFeatChoices = classFeatChoices.some((choice) => !form.chosenClassFeatIds[choice.featureName]);
  const missingClassExpertiseChoices = classExpertiseChoices.some((choice) => (form.chosenFeatOptions[choice.key] ?? []).length < choice.count);
  const allFeatChoices = [...bgFeatChoices, ...raceFeatChoices, ...classSelectedFeatChoices, ...levelUpFeatChoices];
  const missingFeatOptionSelections = allFeatChoices
    .filter(({ choice }) => choice.type !== "spell" && choice.type !== "spell_list")
    .some(({ key, choice }) => (form.chosenFeatOptions[key] ?? []).length < choice.count);
  const missingCoreLanguages = form.chosenRaceLanguages.length < (coreLanguageChoice?.choose ?? 0);
  const missingClassLanguages = form.chosenClassLanguages.length < (classLanguageChoice?.choose ?? 0);
  const missingWeaponMasteries = weaponMasteryChoice != null && form.chosenWeaponMasteries.length < weaponMasteryChoice.count;
  const hasAnything =
    classFeatChoices.length > 0 ||
    classSelectedFeatChoices.length > 0 ||
    bgFeatChoices.length > 0 ||
    raceFeatChoices.length > 0 ||
    classExpertiseChoices.length > 0 ||
    Boolean(weaponMasteryChoice) ||
    Boolean(classLanguageChoice) ||
    Boolean(coreLanguageChoice) ||
    (bgDetail?.proficiencies?.languages?.fixed.length ?? 0) > 0 ||
    (bgDetail?.proficiencies?.languages?.choose ?? 0) > 0 ||
    bgSkillFixed.length > 0 ||
    weaponOptions.length > 0;

  return {
    bgFeatChoices,
    raceFeatChoices,
    selectedClassFeatEntries,
    classSelectedFeatChoices,
    allFeatChoices,
    missingClassFeatChoices,
    missingClassExpertiseChoices,
    missingFeatOptionSelections,
    missingCoreLanguages,
    missingClassLanguages,
    missingWeaponMasteries,
    hasAnything,
    takenSkillKeys,
    takenToolKeys,
    takenLanguageKeys,
    takenExpertiseKeys,
  };
}

export function getFixedGrantsForStep5(feat: Step5ParsedFeatLike): string[] {
  return [
    ...feat.grants.skills,
    ...feat.grants.tools,
    ...feat.grants.languages,
    ...feat.grants.weapons,
    ...feat.grants.armor,
  ];
}

export function getFeatChoiceOptionsForStep5(choice: Step5FeatChoiceLike): string[] {
  return getFeatChoiceOptions(choice as never);
}
