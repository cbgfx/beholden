import type { CharacterClassEntry } from "./characterClasses";
import { removeClassProgressionOccurrences, type ProgressionReplacementEvent, type ProgressionSelectionOccurrence } from "./progressionOwnership";
import { removeHpProgressionClassLevel } from "./progressionHp";

type Tagged = { classEntryId?: string | null; sourceKey?: string | null; level?: number | null; [key: string]: unknown };

export function buildClassLevelReduction(args: {
  classEntryId: string;
  classes: CharacterClassEntry[];
  characterData: Record<string, any>;
  level: number;
  hpMax: number;
  hpCurrent: number;
  abilityScores?: Record<string, number | null | undefined>;
}): { level: number; hpMax: number; hpCurrent: number; className?: string; abilityScores: Record<string, number>; characterData: Record<string, unknown> } | { error: string } {
  const selected = args.classes.find((entry) => entry.id === args.classEntryId);
  if (!selected) return { error: "The selected class no longer exists." };
  if (args.level <= 1) return { error: "A character must retain at least one level." };
  const targetClassLevel = selected.level - 1;
  const nextClasses = targetClassLevel === 0
    ? args.classes.filter((entry) => entry.id !== selected.id)
    : args.classes.map((entry) => entry.id === selected.id ? { ...entry, level: targetClassLevel } : entry);
  if (!nextClasses.length) return { error: "A character must retain at least one class." };
  const targetLevel = args.level - 1;
  const removedFeatEntries = (Array.isArray(args.characterData.chosenLevelUpFeats) ? args.characterData.chosenLevelUpFeats : [])
    .filter((entry: any) => entry.classEntryId === selected.id && Number(entry.classLevel ?? entry.level) > targetClassLevel);
  const constitutionDecrease = removedFeatEntries.reduce((sum: number, entry: any) => sum + Math.max(0, Number(entry.abilityBonuses?.con) || 0), 0);
  const allFeatEntries = Array.isArray(args.characterData.chosenLevelUpFeats) ? args.characterData.chosenLevelUpFeats : [];
  const rawHpEffects = Array.isArray(args.characterData.progressionHpEffects) ? args.characterData.progressionHpEffects : [];
  const hpEffects = rawHpEffects.length > 0 ? rawHpEffects : allFeatEntries.map((entry: any) => ({ sourceKey: entry.sourceFeatureId ?? entry.featId, multiplier: entry.hitPointMaxBonusPerLevel, classEntryId: entry.classEntryId, classLevel: entry.classLevel ?? entry.level }));
  const retainedHpEffects = hpEffects.filter((effect: any) => effect.classEntryId !== selected.id || Number(effect.classLevel) <= targetClassLevel);
  const featureHpBefore = hpEffects.reduce((sum: number, effect: any) => sum + Math.max(0, Number(effect.multiplier) || 0) * args.level, 0);
  const retainedFeatEntries = allFeatEntries.filter((entry: any) => entry.classEntryId !== selected.id || Number(entry.classLevel ?? entry.level) <= targetClassLevel);
  const featureHpAfter = retainedHpEffects.reduce((sum: number, effect: any) => sum + Math.max(0, Number(effect.multiplier) || 0) * targetLevel, 0);
  const removedFeatureHp = Math.max(0, featureHpBefore - featureHpAfter);
  const reversedHp = removeHpProgressionClassLevel(args.characterData.hpProgressionHistory, selected.id, selected.level, constitutionDecrease);
  if (!reversedHp) return { error: "This class level cannot be removed safely because its exact per-level HP record is missing." };
  const removedHp = args.hpMax - reversedHp.hpMax;
  const occurrences = removeClassProgressionOccurrences(
    Array.isArray(args.characterData.progressionSelectionOccurrences) ? args.characterData.progressionSelectionOccurrences : [],
    selected.id, targetClassLevel,
  );
  const removedOccurrenceIds = new Set((args.characterData.progressionSelectionOccurrences ?? [])
    .filter((entry: ProgressionSelectionOccurrence) => !occurrences.some((kept) => kept.occurrenceId === entry.occurrenceId))
    .map((entry: ProgressionSelectionOccurrence) => entry.occurrenceId));
  const keepTagged = (value: unknown) => (Array.isArray(value) ? value : []).filter((entry: Tagged) => {
    if (!entry || typeof entry !== "object") return true;
    const owned = entry.classEntryId === selected.id || entry.sourceKey === `class:${selected.id}`;
    return !owned || (targetClassLevel > 0 && (entry.level == null || Number(entry.level) <= targetClassLevel));
  });
  const proficiencies = { ...(args.characterData.proficiencies ?? {}) };
  for (const key of Object.keys(proficiencies)) proficiencies[key] = keepTagged(proficiencies[key]);
  const classSpellSelections = { ...(args.characterData.classSpellSelections ?? {}) };
  if (targetClassLevel === 0) delete classSpellSelections[selected.id];
  const chosenLevelUpFeats = retainedFeatEntries;
  const acquisitionLevels = { ...(args.characterData.acquisitionLevels ?? {}) };
  const replacementEvents = (Array.isArray(args.characterData.progressionReplacementEvents) ? args.characterData.progressionReplacementEvents : [])
    .filter((event: ProgressionReplacementEvent) => event.classEntryId !== selected.id || event.classLevel <= targetClassLevel)
    .filter((event: ProgressionReplacementEvent) => !removedOccurrenceIds.has(event.addedOccurrenceId));
  const selectedClassOccurrences = (kind: string) => occurrences.filter((entry) => entry.kind === kind && entry.classEntryId === selected.id).map((entry) => entry.valueId);
  const abilityScores = { ...(args.abilityScores ?? {}) } as Record<string, number>;
  for (const feat of removedFeatEntries) for (const [ability, bonus] of Object.entries(feat.abilityBonuses ?? {})) {
    abilityScores[ability] = Math.max(1, Number(abilityScores[ability] ?? 10) - Math.max(0, Number(bonus) || 0));
  }
  const nextData: Record<string, unknown> = {
    ...args.characterData, classes: nextClasses, hpProgressionHistory: reversedHp.history,
    classSpellSelections, chosenLevelUpFeats, acquisitionLevels, proficiencies,
    progressionSelectionOccurrences: occurrences, progressionReplacementEvents: replacementEvents,
    progressionHpEffects: retainedHpEffects,
    chosenOptionals: occurrences.filter((entry) => entry.kind === "optional").map((entry) => entry.valueId),
    extraFeatIds: occurrences.filter((entry) => entry.kind === "extra-feat").map((entry) => entry.valueId),
  };
  if (targetClassLevel > 0 && (selectedClassOccurrences("invocation").length || occurrences.some((entry) => entry.classEntryId === selected.id))) {
    const selection = { ...(classSpellSelections[selected.id] ?? {}), chosenInvocations: selectedClassOccurrences("invocation") };
    classSpellSelections[selected.id] = selection;
  }
  return {
    level: targetLevel, hpMax: reversedHp.hpMax,
    hpCurrent: Math.max(0, Math.min(reversedHp.hpMax + featureHpAfter, args.hpCurrent - Math.max(0, removedHp) - removedFeatureHp)),
    ...(args.classes[0]?.id === selected.id && targetClassLevel === 0 ? { className: nextClasses[0]?.className ?? "Class" } : {}),
    abilityScores, characterData: nextData,
  };
}
