import type { CharacterData } from "@/views/character/CharacterSheetTypes";
import type {
  BgDetail,
  ClassDetail,
  ClassSummary,
  LevelUpFeatDetail,
  RaceDetail,
  SpellSummary,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import type {
  ParsedFeatChoiceLike as ParsedFeatChoice,
  ParsedFeatLike as ParsedFeat,
  ParsedFeatDetailLike as FeatDetail,
} from "@/views/character-creator/utils/FeatChoiceTypes";
import { buildAppliedCharacterFeatures } from "@/domain/character/characterFeatures";
import { normalizeSpellTrackingKey } from "@/views/character/CharacterSheetUtils";
import { deriveCreatorSheetFacts } from "@/views/character-creator/utils/CharacterCreatorDerivedStats";
import { parseAppliedClassFeatureEffects, parseAppliedSpeciesTraitEffects } from "@/views/character-creator/utils/CharacterCreatorClassFeatureUtils";
import {
  deriveFeatGrantedAbilityBonuses,
  deriveRaceAbilityBonuses,
  deriveTotalFeatAbilityBonuses,
  resolvedScores,
  type FormState,
} from "@/views/character-creator/utils/CharacterCreatorFormUtils";
import { buildProficiencyMap as buildProficiencyMapFromUtils } from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";
import { getPreparedSpellCount } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { buildCreatorStartingInventory } from "@/views/character-creator/creatorSubmissionInventory";
import { deriveFeatHitPointMaxBonus } from "@/domain/character/featEffects";
import { appendMissingFeatureNotes } from "@/domain/character/featureNoteTemplates";
import { reconcileInvocationExtraFeatIds } from "@/domain/character/invocationFeatChoices";

type ApiFn = <T>(path: string, init?: RequestInit) => Promise<T>;

function optionalText(value: string | undefined): string {
  return (value ?? "").trim();
}

function positiveIntOrNull(value: unknown): number | null {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function buildCreatorSubmissionBody(args: {
  api: ApiFn;
  form: FormState;
  classDetail: ClassDetail | null;
  selectedClassSummary: ClassSummary | null;
  raceDetail: RaceDetail | null;
  bgDetail: BgDetail | null;
  featDetailCache: Record<string, FeatDetail>;
  resolvedRaceFeatDetail: FeatDetail | null;
  resolvedBgOriginFeatDetail: FeatDetail | null;
  classFeatDetails: Record<string, FeatDetail>;
  levelUpFeatDetails: LevelUpFeatDetail[];
  featSpellChoiceOptions: Record<string, Array<{ id: string; name: string }>>;
  growthOptionEntriesByKey: Record<string, Array<{ id: string; name: string; rarity?: string | null; type?: string | null; magic?: boolean; attunement?: boolean }>>;
  classCantrips: SpellSummary[];
  classSpells: SpellSummary[];
  classInvocations: SpellSummary[];
  isEditing: boolean;
  fallbackClassName?: string | null;
  fallbackHitDie?: number | null;
  fallbackSpecies?: string | null;
  existingHpCurrent?: number | null;
  existingExtraFeatIds: string[];
  existingInvocationFeatIds: string[];
  classifyFeatSelection: (
    choice: ParsedFeatChoice<string>,
    value: string,
  ) => "skill" | "tool" | "language" | "armor" | "weapon" | "saving_throw" | "weapon_mastery" | "maneuver" | null;
}) {
  const {
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
    existingExtraFeatIds,
    existingInvocationFeatIds,
    classifyFeatSelection,
  } = args;

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
  const selectedInvocationIds = new Set(form.chosenInvocations);
  const invocationFeatIds = Array.from(new Set(classInvocations
    .filter((invocation) => selectedInvocationIds.has(invocation.id))
    .flatMap((invocation) => (invocation.effects ?? []).flatMap((rawEffect) => {
      const effect = rawEffect as Record<string, unknown>;
      if (effect.type !== "feat_choice" || effect.mode !== "learn") return [];
      const choiceId = String(effect.choiceId ?? "").trim();
      return choiceId ? (form.chosenFeatOptions[`invocation:${choiceId}`] ?? []) : [];
    }))));
  const selectedFeatIds = Array.from(
    new Set(
      [
        raceFeatId,
        bgFeatId,
        ...classFeatEntries.map(([, featId]) => featId.trim()),
        ...levelUpFeatEntries.map((entry) => entry.featId.trim()),
        ...invocationFeatIds,
      ].filter(Boolean),
    ),
  );
  const submittedExtraFeatIds = reconcileInvocationExtraFeatIds(
    existingExtraFeatIds,
    existingInvocationFeatIds,
    invocationFeatIds,
  );

  const submitFeatDetailById = new Map<string, FeatDetail<ParsedFeatChoice<string>>>(
    Object.entries(featDetailCache)
      .filter(([, detail]) => Boolean(detail?.id))
      .map(([, detail]) => [String(detail.id), detail]),
  );
  if (resolvedRaceFeatDetail?.id) submitFeatDetailById.set(resolvedRaceFeatDetail.id, resolvedRaceFeatDetail);
  if (resolvedBgOriginFeatDetail?.id) submitFeatDetailById.set(resolvedBgOriginFeatDetail.id, resolvedBgOriginFeatDetail);
  for (const detail of Object.values(classFeatDetails)) {
    if (detail?.id) submitFeatDetailById.set(detail.id, detail);
  }
  for (const detail of levelUpFeatDetails) {
    if (detail?.feat?.id) submitFeatDetailById.set(detail.feat.id, detail.feat);
  }

  const missingFeatIds = selectedFeatIds.filter((id) => !submitFeatDetailById.has(id));
  if (missingFeatIds.length > 0) {
    const payload = await api<{ rows: Array<{ id: string; feat: ({ name: string; text?: string; parsed: ParsedFeat } & Record<string, unknown>) | null }> }>(
      "/api/compendium/feats/lookup",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: missingFeatIds, ruleset: form.ruleset }),
      },
    );
    for (const row of payload.rows ?? []) {
      if (!row?.id || !row?.feat) continue;
      submitFeatDetailById.set(String(row.id), {
        id: String(row.id),
        name: String(row.feat.name ?? ""),
        text: typeof row.feat.text === "string" ? row.feat.text : undefined,
        parsed: row.feat.parsed as ParsedFeat,
      });
    }
  }

  const submitRaceFeatDetail = raceFeatId ? submitFeatDetailById.get(raceFeatId) ?? null : null;
  const submitBgOriginFeatDetail = bgFeatId ? submitFeatDetailById.get(bgFeatId) ?? null : null;
  const submitClassFeatDetails = Object.fromEntries(
    classFeatEntries.flatMap(([featureName, featId]) => {
      const detail = submitFeatDetailById.get(featId);
      return detail ? [[featureName, detail] as const] : [];
    }),
  );
  const submitLevelUpFeatDetails = levelUpFeatEntries.flatMap(({ level, featId }) => {
    const detail = submitFeatDetailById.get(featId);
    return detail ? [{ level, featId, feat: detail } satisfies LevelUpFeatDetail] : [];
  });
  const submitInvocationFeatDetails = invocationFeatIds.flatMap((featId) => {
    const detail = submitFeatDetailById.get(featId);
    return detail ? [detail] : [];
  });
  const submitFeatGrantedAbilityBonuses = deriveFeatGrantedAbilityBonuses({
    bgOriginFeatDetail: submitBgOriginFeatDetail,
    raceFeatDetail: submitRaceFeatDetail,
    classFeatDetails: submitClassFeatDetails,
    levelUpFeatDetails: submitLevelUpFeatDetails,
    chosenFeatOptions: form.chosenFeatOptions,
  });
  const submitFeatAbilityBonuses = deriveTotalFeatAbilityBonuses(
    submitFeatGrantedAbilityBonuses,
    form.chosenLevelUpFeats,
  );
  const submitRaceAbilityBonuses = deriveRaceAbilityBonuses(raceDetail, raceDetail?.parsedChoices?.abilityScoreChoice, form);
  const scores = resolvedScores(form, submitFeatAbilityBonuses, submitRaceAbilityBonuses);
  const selectedFeatureNames = buildAppliedCharacterFeatures({
    charData: {
      classes: [{
        id: `class_${form.classId}`,
        classId: form.classId,
        className: classDetail?.name ?? selectedClassSummary?.name ?? fallbackClassName ?? null,
        level: form.level,
        subclass: form.subclass || null,
      }],
      chosenOptionals: form.chosenOptionals,
    } as CharacterData,
    characterLevel: form.level,
    classDetail,
    raceDetail,
    backgroundDetail: bgDetail,
    bgOriginFeatDetail: submitBgOriginFeatDetail,
    raceFeatDetail: submitRaceFeatDetail,
    classFeatDetails: Object.entries(form.chosenClassFeatIds)
      .map(([featureName]) => submitClassFeatDetails[featureName])
      .filter(Boolean),
    levelUpFeatDetails: submitLevelUpFeatDetails,
    invocationDetails: [],
    extraFeatDetails: submitInvocationFeatDetails,
  }).map((feature) => feature.name);
  const startingInventory = await buildCreatorStartingInventory({
    form,
    bgDetail,
    classDetail,
    isEditing,
    classifyFeatSelection,
  });

  const hpMax = Number(form.hpMax) || 0;
  const className = classDetail?.name ?? selectedClassSummary?.name ?? fallbackClassName ?? "";
  const species = raceDetail?.name ?? fallbackSpecies ?? "";
  const hitDie =
    positiveIntOrNull(classDetail?.hd)
    ?? positiveIntOrNull(selectedClassSummary?.hd)
    ?? positiveIntOrNull(fallbackHitDie);
  if (hitDie == null) throw new Error(`Class ${form.classId || className} has no canonical hit die.`);
  const featHpMaxBonus = deriveFeatHitPointMaxBonus([
    submitRaceFeatDetail,
    submitBgOriginFeatDetail,
    ...Object.values(submitClassFeatDetails),
    ...submitLevelUpFeatDetails.map(({ feat }) => feat),
    ...submitInvocationFeatDetails,
  ], form.level);
  const effectiveHpMax = hpMax + featHpMaxBonus;
  const preservedHpCurrent =
    isEditing && Number.isFinite(Number(existingHpCurrent))
      ? Math.max(0, Math.min(Number(existingHpCurrent), effectiveHpMax))
      : effectiveHpMax;
  const initialFeatureNotes = !isEditing && classDetail
    ? appendMissingFeatureNotes([], classDetail.autolevels
        .filter((entry) => entry.level <= form.level)
        .flatMap((entry) => entry.features)
        .filter((feature) => !feature.subclass || feature.subclass === form.subclass)
        .filter((feature) => !feature.optional || form.chosenOptionals.includes(feature.name))
        .map((feature) => feature.noteTemplate))
    : [];

  const body = {
    name: form.characterName.trim(),
    playerName: optionalText(form.playerName),
    ruleset: form.ruleset ?? "5.5e",
    className,
    species,
    level: form.level,
    hpMax,
    hpCurrent: preservedHpCurrent,
    ac: Number(form.ac) || 10,
    speed: Number(form.speed) || 30,
    strScore: scores.str, dexScore: scores.dex, conScore: scores.con,
    intScore: scores.int, wisScore: scores.wis, chaScore: scores.cha,
    color: form.color,
    characterData: {
      classes: [{
        id: `class_${form.classId}`,
        classId: form.classId,
        className: className || null,
        level: form.level,
        subclass: form.subclass || null,
      }],
      raceId: form.raceId,
      bgId: form.bgId,
      abilityMethod: form.abilityMethod,
      standardAssign: form.abilityMethod === "standard" ? form.standardAssign : undefined,
      pbScores: form.abilityMethod === "pointbuy" ? form.pbScores : undefined,
      bgAbilityMode: form.bgAbilityMode,
      bgAbilityBonuses: form.bgAbilityBonuses,
      alignment: optionalText(form.alignment),
      hair: optionalText(form.hair),
      skin: optionalText(form.skin),
      height: optionalText(form.heightText),
      age: optionalText(form.age),
      weight: optionalText(form.weight),
      gender: optionalText(form.gender),
      hd: hitDie,
      derivedHpMax: effectiveHpMax,
      chosenOptionals: form.chosenOptionals,
      selectedFeatureNames,
      chosenClassFeatIds: form.chosenClassFeatIds,
      chosenLevelUpFeats: form.chosenLevelUpFeats,
      chosenRaceSkills: form.chosenRaceSkills,
      chosenRaceLanguages: form.chosenRaceLanguages,
      chosenRaceTools: form.chosenRaceTools,
      chosenRaceFeatId: form.chosenRaceFeatId,
      chosenRaceSize: form.chosenRaceSize,
      chosenRaceSpellAbility: form.chosenRaceSpellAbility,
      chosenRaceAbilityChoices: form.chosenRaceAbilityChoices,
      raceAbilityMode: form.raceAbilityMode,
      raceAbilityBonuses: form.raceAbilityBonuses,
      chosenBgOriginFeatId: form.chosenBgOriginFeatId,
      chosenSkills: form.chosenSkills,
      chosenClassLanguages: form.chosenClassLanguages,
      chosenClassTools: form.chosenClassTools,
      chosenClassEquipmentOption: form.chosenClassEquipmentOption,
      chosenBgEquipmentOption: form.chosenBgEquipmentOption,
      chosenFeatOptions: form.chosenFeatOptions,
      chosenFeatureChoices: form.chosenFeatureChoices,
      chosenWeaponMasteries: form.chosenWeaponMasteries,
      chosenCantrips: form.chosenCantrips,
      chosenSpells: form.chosenSpells,
      preparedSpells:
        classDetail && classDetail.slotsReset !== "S" && getPreparedSpellCount(classDetail, form.level, form.subclass, scores[String(classDetail.spellAbility ?? "").toLowerCase()]) > 0
          ? form.chosenSpells
            .map((id) => classSpells.find((spell) => spell.id === id)?.name ?? "")
            .filter(Boolean)
            .map(normalizeSpellTrackingKey)
          : undefined,
      chosenInvocations: form.chosenInvocations,
      ...((isEditing || submittedExtraFeatIds.length > 0) ? { extraFeatIds: submittedExtraFeatIds } : {}),
      ...(initialFeatureNotes.length > 0 ? { playerNotesList: initialFeatureNotes } : {}),
      ...(startingInventory ? { inventory: startingInventory } : {}),
      proficiencies: buildProficiencyMapFromUtils({
        form,
        classDetail,
        raceDetail,
        bgDetail,
        classCantrips,
        classSpells,
        classInvocations,
        bgOriginFeatDetail: submitBgOriginFeatDetail,
        raceFeatDetail: submitRaceFeatDetail,
        classFeatDetails: submitClassFeatDetails,
        levelUpFeatDetails: submitLevelUpFeatDetails,
        extraFeatDetails: submitInvocationFeatDetails,
        spellChoiceOptionsByKey: featSpellChoiceOptions,
        itemChoiceOptionsByKey: growthOptionEntriesByKey,
      }),
    },
  };

  if (!isEditing || startingInventory) {
    const finalized = deriveCreatorSheetFacts({
      baseSpeed: raceDetail?.speed ?? (Number(form.speed) || 30),
      level: form.level,
      scores,
      classFeatureEffects: parseAppliedClassFeatureEffects(classDetail, form.level, form.subclass, form.chosenOptionals),
      speciesTraitEffects: parseAppliedSpeciesTraitEffects(raceDetail),
    });
    body.ac = finalized.ac;
    body.speed = finalized.speed;
  }

  return { body };
}
