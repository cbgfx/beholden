import type { ClassSpellSelection } from "@/domain/character/classSpellSelections";
import type { CharacterData, ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import type {
  BgDetail,
  ClassDetail,
  ClassSummary,
  LevelUpFeatDetail,
  LevelUpFeatSelection,
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
import { carryPreparedSpells } from "@beholden/shared/domain/spellPreparation";
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
import { getPreparedSpellCount, usesFlexiblePreparedSpells } from "@/views/character-creator/utils/CharacterCreatorUtils";
import { buildCreatorStartingInventory } from "@/views/character-creator/creatorSubmissionInventory";
import { deriveFeatHitPointMaxBonus } from "@/domain/character/featEffects";
import { buildInitialHpProgressionHistory, reverseHpProgressionToLevel } from "@beholden/shared/domain/progressionHp";
import { appendMissingFeatureNotes } from "@/domain/character/featureNoteTemplates";
import { reconcileInvocationExtraFeatIds } from "@/domain/character/invocationFeatChoices";
import { tagAcquisitionLevelMap } from "@/domain/character/spellAcquisition";
import { createDefaultSheetViews } from "@/views/character/layout/sheetViewLayout";
import { reconcileProgressionOccurrences, type ProgressionReplacementEvent, type ProgressionSelectionOccurrence } from "@beholden/shared/domain/progressionOwnership";

type ApiFn = <T>(path: string, init?: RequestInit) => Promise<T>;

/** The built proficiencies with their spells prepared as carried over and newly chosen. */
function withCarriedPreparation<T extends { spells: Array<{ name: string }> }>(
  proficiencies: T,
  carriedFrom: Array<{ name: string; prepared?: boolean }>,
  newlyPrepared: string[],
): T {
  return { ...proficiencies, spells: carryPreparedSpells(proficiencies.spells, carriedFrom, newlyPrepared) };
}

export function resolveCreatorTotalLevel(
  primaryClassLevel: number,
  existingClasses: Array<{ level?: number }>,
): number {
  return primaryClassLevel + existingClasses.slice(1).reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.level) || 0),
    0,
  );
}

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
  existingHpMax?: number | null;
  existingHpProgressionHistory?: unknown[];
  existingCharacterRevision?: number | null;
  existingClassSpellSelections?: Record<string, ClassSpellSelection>;
  existingExtraFeatIds: string[];
  existingInvocationFeatIds: string[];
  existingSpells?: Array<{ id?: string; name?: string; level?: number | null; classEntryId?: string | null; prepared?: boolean }>;
  existingInvocations?: Array<{ id?: string; level?: number | null }>;
  existingAcquisitionLevels?: Record<string, number | null>;
  preservedLevelUpFeats?: LevelUpFeatSelection[];
  preservedLevelUpFeatOptions?: Record<string, string[]>;
  existingClasses?: Array<{ id?: string; classId?: string | null; className?: string | null; level?: number; subclass?: string | null }>;
  existingSelectedFeatureNames?: string[];
  existingProficiencies?: Partial<ProficiencyMap>;
  existingProgressionSelectionOccurrences?: ProgressionSelectionOccurrence[];
  existingProgressionReplacementEvents?: ProgressionReplacementEvent[];
  existingProgressionHpEffects?: Array<{ sourceKey: string; multiplier: number; classEntryId?: string; classLevel?: number }>;
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
    existingSpells,
    existingInvocations,
    existingAcquisitionLevels,
    existingClasses = [],
    existingSelectedFeatureNames = [],
    existingProficiencies,
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

  // Preserve when each Pact Boon/Fighting Style pick and invocation-granted feat was acquired,
  // same preserve-or-stamp rule as spells/invocations (tagAcquisitionLevel): editing an existing
  // character keeps prior tags, only genuinely new picks get stamped with the current build level.
  const submittedAcquisitionLevels = {
    ...tagAcquisitionLevelMap(
      form.chosenOptionals.map((name) => `optional:${name}`),
      existingAcquisitionLevels,
      form.level,
    ),
    ...tagAcquisitionLevelMap(
      submittedExtraFeatIds.map((id) => `extraFeat:${id}`),
      existingAcquisitionLevels,
      form.level,
    ),
  };
  const primaryClassEntryId = existingClasses[0]?.id ?? `class_${form.classId}`;
  const invocationLevels = new Map((existingInvocations ?? []).flatMap((entry) => entry.id && entry.level != null ? [[entry.id, entry.level] as const] : []));
  const invocationOccurrences = reconcileProgressionOccurrences({
    existing: args.existingProgressionSelectionOccurrences ?? [], kind: "invocation", values: form.chosenInvocations,
    sourceKey: `class:${primaryClassEntryId}:invocations`, classEntryId: primaryClassEntryId,
    classLevel: form.level, characterLevel: resolveCreatorTotalLevel(form.level, existingClasses),
    classLevelForValue: (id) => invocationLevels.get(id) ?? form.level,
  });
  const optionalOccurrences = reconcileProgressionOccurrences({
    existing: invocationOccurrences, kind: "optional", values: form.chosenOptionals,
    sourceKey: `class:${primaryClassEntryId}:optionals`, classEntryId: primaryClassEntryId,
    classLevel: form.level, characterLevel: resolveCreatorTotalLevel(form.level, existingClasses), preserveAcrossOwners: true,
    classLevelForValue: (name) => submittedAcquisitionLevels[`optional:${name}`] ?? form.level,
  });
  const progressionSelectionOccurrences = reconcileProgressionOccurrences({
    existing: optionalOccurrences, kind: "extra-feat", values: submittedExtraFeatIds,
    sourceKey: `class:${primaryClassEntryId}:extra-feats`, classEntryId: primaryClassEntryId,
    classLevel: form.level, characterLevel: resolveCreatorTotalLevel(form.level, existingClasses), preserveAcrossOwners: true,
    classLevelForValue: (id) => submittedAcquisitionLevels[`extraFeat:${id}`] ?? form.level,
  });
  const previousOccurrences = args.existingProgressionSelectionOccurrences ?? [];
  const previousIds = new Set(previousOccurrences.map((entry) => entry.occurrenceId));
  const currentIds = new Set(progressionSelectionOccurrences.map((entry) => entry.occurrenceId));
  const addedOccurrences = progressionSelectionOccurrences.filter((entry) => !previousIds.has(entry.occurrenceId));
  const usedAdded = new Set<string>();
  const newReplacementEvents: ProgressionReplacementEvent[] = previousOccurrences
    .filter((entry) => entry.classEntryId === primaryClassEntryId && !currentIds.has(entry.occurrenceId))
    .flatMap((removed) => {
      const added = addedOccurrences.find((candidate) => candidate.kind === removed.kind && !usedAdded.has(candidate.occurrenceId));
      if (!added) return [];
      usedAdded.add(added.occurrenceId);
      return [{ eventId: `replace:${primaryClassEntryId}:${form.level}:${removed.occurrenceId}:${added.occurrenceId}`, kind: added.kind, sourceKey: added.sourceKey, removedOccurrenceId: removed.occurrenceId, addedOccurrenceId: added.occurrenceId, classEntryId: primaryClassEntryId, classLevel: form.level, characterLevel: resolveCreatorTotalLevel(form.level, existingClasses) }];
    });

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
  // Secondary and ambiguous legacy progression records are intentionally outside the primary
  // editor. Their recorded permanent bonuses still contribute to the character's final scores.
  for (const entry of args.preservedLevelUpFeats ?? []) {
    for (const [ability, value] of Object.entries(entry.abilityBonuses ?? {})) {
      submitFeatGrantedAbilityBonuses[ability] = (submitFeatGrantedAbilityBonuses[ability] ?? 0) + (Number(value) || 0);
    }
  }
  const submitFeatAbilityBonuses = deriveTotalFeatAbilityBonuses(
    submitFeatGrantedAbilityBonuses,
    form.chosenLevelUpFeats,
  );
  const submitRaceAbilityBonuses = deriveRaceAbilityBonuses(raceDetail, raceDetail?.parsedChoices?.abilityScoreChoice, form);
  const scores = resolvedScores(form, submitFeatAbilityBonuses, submitRaceAbilityBonuses);
  const selectedFeatureNames = buildAppliedCharacterFeatures({
    charData: {
      classes: [{
        id: existingClasses[0]?.id ?? `class_${form.classId}`,
        classId: form.classId,
        className: classDetail?.name ?? selectedClassSummary?.name ?? fallbackClassName ?? null,
        level: form.level,
        subclass: form.subclass || null,
      }],
      chosenOptionals: form.chosenOptionals,
      chosenFeatureChoices: form.chosenFeatureChoices,
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
  // This computation is inherently scoped to the primary class only (classDetail is a single
  // class's data, and this editor never loads a second class's detail) -- so before saving,
  // reunite it with any existing selected-feature names it has no way to derive, i.e. anything
  // that isn't even a possible name for THIS class. Otherwise a multiclass character's other
  // class's optional-feature picks (Fighting Style, Pact Boon, ...) go from "selected" to
  // "unselected" the moment this editor is used for literally anything unrelated.
  const primaryClassFeatureNameUniverse = new Set(
    (classDetail?.autolevels ?? []).flatMap((autolevel) => autolevel.features.map((feature) => feature.name)),
  );
  const preservedOtherClassFeatureNames = existingSelectedFeatureNames.filter(
    (name) => !primaryClassFeatureNameUniverse.has(name),
  );
  const finalSelectedFeatureNames = Array.from(new Set([...selectedFeatureNames, ...preservedOtherClassFeatureNames]));
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

  const primaryLevelUpFeats = form.chosenLevelUpFeats.map((entry) => ({
    ...entry,
    level: entry.classLevel ?? entry.level,
    classEntryId: primaryClassEntryId,
    classLevel: entry.classLevel ?? entry.level,
    characterLevel: entry.characterLevel ?? (existingClasses.length <= 1 ? entry.level : undefined),
    sourceFeatureId: entry.sourceFeatureId ?? `class:${primaryClassEntryId}:asi:${entry.classLevel ?? entry.level}`,
    ...(entry.type === "feat" && entry.featId ? {
      hitPointMaxBonusPerLevel: deriveFeatHitPointMaxBonus([submitFeatDetailById.get(entry.featId)], 1),
    } : {}),
  }));
  const submittedLevelUpFeats = [
    ...(args.preservedLevelUpFeats ?? []),
    ...primaryLevelUpFeats,
  ];
  const hpEffect = (feat: FeatDetail<ParsedFeatChoice<string>> | null | undefined, sourceKey: string, owner?: { classEntryId: string; classLevel: number }) => {
    const multiplier = deriveFeatHitPointMaxBonus([feat], 1);
    return multiplier > 0 ? [{ sourceKey, multiplier, ...(owner ?? {}) }] : [];
  };
  const generatedHpEffects = [
    ...hpEffect(submitRaceFeatDetail, `race-feat:${submitRaceFeatDetail?.id ?? "none"}`),
    ...hpEffect(submitBgOriginFeatDetail, `background-feat:${submitBgOriginFeatDetail?.id ?? "none"}`),
    ...Object.entries(submitClassFeatDetails).flatMap(([feature, feat]) => hpEffect(feat, `class-feature-feat:${primaryClassEntryId}:${feature}`, { classEntryId: primaryClassEntryId, classLevel: 1 })),
    ...submittedLevelUpFeats.flatMap((entry) => entry.type === "feat" && entry.featId
      ? hpEffect(submitFeatDetailById.get(entry.featId), `level-feat:${entry.classEntryId}:${entry.classLevel}:${entry.featId}`, entry.classEntryId && entry.classLevel ? { classEntryId: entry.classEntryId, classLevel: entry.classLevel } : undefined)
      : []),
    ...submitInvocationFeatDetails.flatMap((feat) => hpEffect(feat, `invocation-feat:${primaryClassEntryId}:${feat.id}`, { classEntryId: primaryClassEntryId, classLevel: submittedAcquisitionLevels[`extraFeat:${feat.id}`] ?? form.level })),
  ];
  const progressionHpEffects = Array.from(new Map([
    ...(args.existingProgressionHpEffects ?? [])
      .filter((effect) => effect.classEntryId !== primaryClassEntryId && !effect.sourceKey.startsWith("race-feat:") && !effect.sourceKey.startsWith("background-feat:"))
      .map((effect) => [effect.sourceKey, effect] as const),
    ...generatedHpEffects.map((effect) => [effect.sourceKey, effect] as const),
  ]).values());
  // Which spells come out prepared. Preparation is a flag on each spell's entry, so the new
  // spell list takes it from the old one. Editing a flexible preparer keeps every prepared spell as
  // it was. Otherwise the primary class is rebuilt: a class that prepares at creation has its chosen
  // spells prepared, any other has none, and every other class keeps what it had.
  const existingSpellEntries = (args.existingSpells ?? [])
    .filter((spell): spell is typeof spell & { name: string } => typeof spell.name === "string");
  const keepsAllPreparations = isEditing && usesFlexiblePreparedSpells(classDetail);
  const primaryPreparedKeys = !keepsAllPreparations
    && classDetail && classDetail.slotsReset !== "S"
    && getPreparedSpellCount(classDetail, form.level, form.subclass, scores[String(classDetail.spellAbility ?? "").toLowerCase()]) > 0
    ? form.chosenSpells
      .map((id) => classSpells.find((spell) => spell.id === id)?.name ?? "")
      .filter(Boolean)
      .map(normalizeSpellTrackingKey)
    : [];
  const preparedCarriedFrom = keepsAllPreparations
    ? existingSpellEntries
    : existingSpellEntries.filter((spell) => spell.classEntryId && spell.classEntryId !== primaryClassEntryId);
  const classSpellSelections = {
    ...args.existingClassSpellSelections,
    [primaryClassEntryId]: {
      ...args.existingClassSpellSelections?.[primaryClassEntryId],
      chosenCantrips: form.chosenCantrips,
      chosenSpells: form.chosenSpells,
      chosenInvocations: form.chosenInvocations,
    },
  };

  const totalLevel = resolveCreatorTotalLevel(form.level, existingClasses);
  const priorTotalLevel = existingClasses.reduce((sum, entry) => sum + Math.max(0, Number(entry.level) || 0), 0);
  const reversedHp = isEditing && existingClasses.length === 1 && totalLevel < priorTotalLevel
    ? reverseHpProgressionToLevel(args.existingHpProgressionHistory, totalLevel)
    : null;
  const repairedHpHistory = isEditing && existingClasses.length === 1 && totalLevel < priorTotalLevel && !reversedHp
    ? buildInitialHpProgressionHistory({
        level: totalLevel, hitDie, constitution: scores.con, hpMax,
        classEntryId: primaryClassEntryId, hpMethod: "manual",
      })
    : null;
  const submittedHpMax = reversedHp?.hpMax ?? hpMax;
  const existingDamage = args.existingHpMax != null && existingHpCurrent != null ? Math.max(0, args.existingHpMax - existingHpCurrent) : 0;
  const submittedHpCurrent = reversedHp || repairedHpHistory ? Math.max(0, submittedHpMax - existingDamage) : preservedHpCurrent;
  const body = {
    name: form.characterName.trim(),
    playerName: optionalText(form.playerName),
    ruleset: form.ruleset ?? "5.5e",
    className,
    species,
    level: totalLevel,
    hpMax: submittedHpMax,
    hpCurrent: submittedHpCurrent,
    ac: Number(form.ac) || 10,
    speed: Number(form.speed) || 30,
    strScore: scores.str, dexScore: scores.dex, conScore: scores.con,
    intScore: scores.int, wisScore: scores.wis, chaScore: scores.cha,
    color: form.color,
    progressionClassEntryId: existingClasses[0]?.id ?? `class_${form.classId}`,
    ...(isEditing && args.existingCharacterRevision != null
      ? { expectedCharacterRevision: args.existingCharacterRevision }
      : {}),
    characterData: {
      progressionSchemaVersion: 3,
      // This editor only ever exposes/edits the character's primary class (FormState has a single
      // classId/level, no concept of a second class) -- existingClasses[0] is that same primary
      // slot the form was hydrated from, so it's replaced with the form's current values, but any
      // *other* class entries (existingClasses[1+], a multiclass character's second/third class)
      // must be carried through unchanged. Overwriting the whole array here previously deleted
      // every class but the one being edited on every single save of a multiclass character.
      classes: [
        {
          id: existingClasses[0]?.id ?? `class_${form.classId}`,
          classId: form.classId,
          className: className || null,
          level: form.level,
          subclass: form.subclass || null,
        },
        ...existingClasses.slice(1),
      ],
      raceId: form.raceId,
      bgId: form.bgId,
      abilityMethod: form.abilityMethod,
      standardAssign: form.abilityMethod === "standard" ? form.standardAssign : undefined,
      pbScores: form.abilityMethod === "pointbuy" ? form.pbScores : undefined,
      rolledScores: form.abilityMethod === "rolled" ? form.rolledScores : undefined,
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
      derivedHpMax: reversedHp ? submittedHpMax + featHpMaxBonus : effectiveHpMax,
      ...(reversedHp ? { hpProgressionHistory: reversedHp.history } : repairedHpHistory ? { hpProgressionHistory: repairedHpHistory } : {}),
      ...(!isEditing ? { hpProgressionHistory: buildInitialHpProgressionHistory({
        level: form.level,
        hitDie,
        constitution: scores.con,
        hpMax,
        classEntryId: primaryClassEntryId,
        hpMethod: form.creationHpMethod,
        physicalRolls: form.creationHpRolls,
      }) } : {}),
      chosenOptionals: form.chosenOptionals,
      selectedFeatureNames: finalSelectedFeatureNames,
      chosenClassFeatIds: form.chosenClassFeatIds,
      chosenLevelUpFeats: submittedLevelUpFeats,
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
      chosenFeatOptions: { ...args.preservedLevelUpFeatOptions, ...form.chosenFeatOptions },
      chosenFeatureChoices: form.chosenFeatureChoices,
      chosenWeaponMasteries: form.chosenWeaponMasteries,
      classSpellSelections,
      acquisitionLevels: submittedAcquisitionLevels,
      progressionSelectionOccurrences,
      progressionReplacementEvents: [...(args.existingProgressionReplacementEvents ?? []), ...newReplacementEvents],
      progressionHpEffects,
      ...((isEditing || submittedExtraFeatIds.length > 0) ? { extraFeatIds: submittedExtraFeatIds } : {}),
      ...(initialFeatureNotes.length > 0 ? { playerNotesList: initialFeatureNotes } : {}),
      ...(startingInventory ? { inventory: startingInventory } : {}),
      // Only ever set on true creation -- this object gets merge-patched into
      // characterData on every edit/level-up save too, and re-sending it then
      // would silently overwrite any layout the player has since customized.
      ...(!isEditing ? { sheetViews: createDefaultSheetViews() } : {}),
      proficiencies: withCarriedPreparation(buildProficiencyMapFromUtils({
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
        existingSpells,
        existingInvocations,
        existingClasses,
        existingProficiencies,
        primaryClassEntryId: existingClasses[0]?.id ?? `class_${form.classId}`,
      }), preparedCarriedFrom, primaryPreparedKeys),
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
