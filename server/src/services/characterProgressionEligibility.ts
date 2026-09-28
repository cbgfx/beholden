import { featEligibilityProblem, type FeatEligibilityFacts, type FeatPrerequisite } from "@beholden/shared/domain/featEligibility";
import type { Db } from "../lib/db.js";

type Json = Record<string, any>;
const array = (value: unknown): any[] => Array.isArray(value) ? value : [];
const names = (value: unknown): string[] => array(value).flatMap((entry) => typeof entry === "string" ? [entry] : typeof entry?.name === "string" ? [entry.name] : []);
const ids = (value: unknown): string[] => array(value).flatMap((entry) => typeof entry === "string" ? [entry] : typeof entry?.id === "string" ? [entry.id] : []);
const parse = (value: string): Json | null => { try { return JSON.parse(value) as Json; } catch { return null; } };

function tableExists(db: Db, table: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

export function characterProgressionEligibilityProblem(db: Db, args: {
  ruleset: "5e" | "5.5e";
  level: number;
  scores: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number | null>>;
  characterData: Record<string, unknown> | null | undefined;
  previousCharacterData?: Record<string, unknown> | null;
}): string | null {
  if (!tableExists(db, "compendium_feats") || !tableExists(db, "compendium_class_talents")) return null;
  const data = (args.characterData ?? {}) as Json;
  const previous = (args.previousCharacterData ?? {}) as Json;
  // Beta records remain readable until the explicit repair/reset flow upgrades them. Once a
  // record declares the canonical schema, compendium-backed eligibility is a hard save gate.
  if (!(Number(data.progressionSchemaVersion) >= 2)) return null;
  const classes = array(data.classes);
  const featIds = [
    ...array(data.chosenLevelUpFeats).flatMap((entry) => typeof entry?.featId === "string" ? [entry.featId] : []),
    ...(typeof data.chosenRaceFeatId === "string" ? [data.chosenRaceFeatId] : []),
    ...(typeof data.chosenBgOriginFeatId === "string" ? [data.chosenBgOriginFeatId] : []),
    ...Object.values(data.chosenClassFeatIds ?? {}).filter((id): id is string => typeof id === "string"),
    ...array(data.extraFeatIds).filter((id): id is string => typeof id === "string"),
  ];
  const prof = data.proficiencies ?? {};
  const normalizedFeatures = array(data.selectedFeatureNames).map((value) => String(value).toLowerCase().replace(/[^a-z]+/gu, "_"));
  const facts: FeatEligibilityFacts = {
    level: args.level,
    classNames: classes.flatMap((entry) => typeof entry?.className === "string" ? [entry.className] : []),
    scores: args.scores, featIds, features: normalizedFeatures,
    armor: names(prof.armor), weapons: names(prof.weapons),
    spellcaster: normalizedFeatures.includes("spellcasting") || normalizedFeatures.includes("pact_magic") || Object.values(data.classSpellSelections ?? {}).some((selection: any) => array(selection?.chosenCantrips).length + array(selection?.chosenSpells).length > 0) || names(prof.spells).length > 0,
  };

  for (const entry of array(data.chosenLevelUpFeats)) {
    if (!entry?.classEntryId || !Number.isInteger(Number(entry.classLevel ?? entry.level))) return "Every level-up feat or ASI must identify its owning class and class level.";
    const classEntry = classes.find((candidate) => candidate?.id === entry.classEntryId);
    if (!classEntry?.classId) continue;
    const row = db.prepare("SELECT data_json FROM compendium_classes WHERE id = ? AND ruleset = ?").get(classEntry.classId, args.ruleset) as { data_json: string } | undefined;
    const detail = row ? parse(row.data_json) : null;
    if (!detail) return `Class ${classEntry.classId} does not exist in the ${args.ruleset} compendium.`;
    const classLevel = Number(entry.classLevel ?? entry.level);
    if (!array(detail.levels ?? detail.autolevels).some((level) => Number(level?.level) === classLevel && (level?.abilityScoreImprovement === true || level?.scoreImprovement === true))) return `Class level ${classLevel} does not grant an Ability Score Improvement or feat choice.`;
  }

  const featCounts = new Map<string, number>();
  const featDetails = new Map<string, Json>();
  for (const featId of featIds) featCounts.set(featId, (featCounts.get(featId) ?? 0) + 1);
  for (const [featId, count] of featCounts) {
    const row = db.prepare("SELECT name, data_json FROM compendium_feats WHERE id = ? AND ruleset = ?").get(featId, args.ruleset) as { name: string; data_json: string } | undefined;
    if (!row) return `Selected feat ${featId} does not exist in the ${args.ruleset} compendium.`;
    const detail = parse(row.data_json);
    if (!detail) return `Selected feat ${row.name} has invalid compendium data.`;
    featDetails.set(featId, detail);
    if (count > 1 && detail.repeatable !== true) return `${row.name} cannot be selected more than once.`;
    const problem = featEligibilityProblem(detail.prerequisite as FeatPrerequisite | undefined, facts);
    if (problem) return `${row.name} ${problem}.`;
  }

  const featOptions = data.chosenFeatOptions && typeof data.chosenFeatOptions === "object" ? data.chosenFeatOptions as Record<string, unknown> : {};
  const previousFeatOptions = previous.chosenFeatOptions && typeof previous.chosenFeatOptions === "object" ? previous.chosenFeatOptions as Record<string, unknown> : {};
  const prefixUnchanged = (prefix: string) => {
    const current = Object.fromEntries(Object.entries(featOptions).filter(([key]) => key.startsWith(`${prefix}:`)));
    const prior = Object.fromEntries(Object.entries(previousFeatOptions).filter(([key]) => key.startsWith(`${prefix}:`)));
    return JSON.stringify(current) === JSON.stringify(prior);
  };
  const priorLevelFeats = array(previous.chosenLevelUpFeats);
  for (const entry of array(data.chosenLevelUpFeats)) {
    if (entry?.type !== "feat" || typeof entry.featId !== "string") continue;
    const levels = new Set([Number(entry.classLevel ?? entry.level), Number(entry.characterLevel)].filter(Number.isFinite));
    const unchanged = priorLevelFeats.some((prior) => prior?.type === "feat" && prior.featId === entry.featId && prior.classEntryId === entry.classEntryId && Number(prior.classLevel ?? prior.level) === Number(entry.classLevel ?? entry.level))
      && Array.from(levels).some((level) => prefixUnchanged(`levelupfeat:${level}:${entry.featId}`));
    if (unchanged) continue;
    const detail = featDetails.get(entry.featId);
    if (!detail) continue;
    for (const choice of array(detail.mechanics?.choices)) {
      const selected = Array.from(levels).flatMap((level) => {
        const value = featOptions[`levelupfeat:${level}:${entry.featId}:${choice.id}`];
        return Array.isArray(value) ? value : [];
      });
      const uniqueSelected = Array.from(new Set(selected.map(String)));
      if (uniqueSelected.length !== Number(choice.count ?? 1)) return `${detail.name ?? entry.featId} requires ${Number(choice.count ?? 1)} selection${Number(choice.count ?? 1) === 1 ? "" : "s"} for ${choice.id}.`;
      if (choice.type !== "spell" && Array.isArray(choice.options) && uniqueSelected.some((value) => !choice.options.includes(value))) return `${detail.name ?? entry.featId} contains an invalid selection for ${choice.id}.`;
    }
  }
  const validateFeatPrefix = (featId: string, prefix: string): string | null => {
    const detail = featDetails.get(featId);
    if (!detail) return null;
    for (const choice of array(detail.mechanics?.choices)) {
      const selected = array(featOptions[`${prefix}:${choice.id}`]).map(String);
      const required = Number(choice.count ?? 1);
      if (selected.length !== required) return `${detail.name ?? featId} requires ${required} selection${required === 1 ? "" : "s"} for ${choice.id}.`;
      if (choice.type !== "spell" && Array.isArray(choice.options) && selected.some((value) => !choice.options.includes(value))) return `${detail.name ?? featId} contains an invalid selection for ${choice.id}.`;
    }
    return null;
  };
  if (typeof data.chosenRaceFeatId === "string") {
    const detail = featDetails.get(data.chosenRaceFeatId);
    const prefix = `race:${detail?.name ?? data.chosenRaceFeatId}`;
    const problem = data.chosenRaceFeatId === previous.chosenRaceFeatId && prefixUnchanged(prefix) ? null : validateFeatPrefix(data.chosenRaceFeatId, prefix);
    if (problem) return problem;
  }
  if (typeof data.chosenBgOriginFeatId === "string") {
    const detail = featDetails.get(data.chosenBgOriginFeatId);
    const prefix = `bg:${detail?.name ?? data.chosenBgOriginFeatId}`;
    const problem = data.chosenBgOriginFeatId === previous.chosenBgOriginFeatId && prefixUnchanged(prefix) ? null : validateFeatPrefix(data.chosenBgOriginFeatId, prefix);
    if (problem) return problem;
  }
  for (const [feature, featId] of Object.entries(data.chosenClassFeatIds ?? {})) {
    if (typeof featId !== "string") continue;
    const problem = validateFeatPrefix(featId, `classfeat:${feature}`);
    if (problem) return problem;
  }
  for (const featId of array(data.extraFeatIds).filter((id): id is string => typeof id === "string")) {
    const problem = validateFeatPrefix(featId, `extra:${featId}`);
    if (problem) return problem;
  }

  const selections = data.classSpellSelections && typeof data.classSpellSelections === "object" ? data.classSpellSelections as Record<string, Json> : {};
  const featureSelections = data.chosenFeatureChoices && typeof data.chosenFeatureChoices === "object" ? data.chosenFeatureChoices as Record<string, unknown> : {};
  for (const classEntry of classes) {
    if (classEntry?.classId) {
      const classRow = db.prepare("SELECT data_json FROM compendium_classes WHERE id = ? AND ruleset = ?").get(classEntry.classId, args.ruleset) as { data_json: string } | undefined;
      const classDetail = classRow ? parse(classRow.data_json) : null;
      if (!classDetail) return `Class ${classEntry.classId} does not exist in the ${args.ruleset} compendium.`;
      for (const level of array(classDetail.levels ?? classDetail.autolevels).filter((candidate) => Number(candidate?.level) <= Number(classEntry.level))) {
        for (const feature of array(level?.features).filter((candidate) => !candidate?.subclass || candidate.subclass === classEntry.subclass)) {
          for (const choice of array(feature?.choices)) {
            if (typeof choice?.id !== "string") continue;
            const selected = array(featureSelections[`classfeature:${choice.id}`]).map(String);
            const required = Number(choice.count ?? 1);
            if (choice.kind === "selection") {
              if (selected.length !== required) return `${feature.name ?? choice.id} requires ${required} selection${required === 1 ? "" : "s"}.`;
              if (selected.some((value) => !array(choice.options).includes(value))) return `${feature.name ?? choice.id} contains a selection outside its canonical options.`;
            } else if (selected.length > required) {
              return `${feature.name ?? choice.id} has too many selections.`;
            }
          }
        }
      }
    }
    const selected = ids(selections[classEntry?.id]?.chosenInvocations);
    const counts = new Map<string, number>();
    for (const id of selected) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [talentId, count] of counts) {
      const row = db.prepare("SELECT name, kind, data_json FROM compendium_class_talents WHERE id = ? AND ruleset = ?").get(talentId, args.ruleset) as { name: string; kind: string; data_json: string } | undefined;
      if (!row || row.kind !== "invocation") return `Selected invocation ${talentId} does not exist in the ${args.ruleset} compendium.`;
      const detail = parse(row.data_json);
      if (!detail) return `Selected invocation ${row.name} has invalid compendium data.`;
      if (count > 1 && detail.repeatable !== true) return `${row.name} cannot be selected more than once.`;
      if (detail.prerequisite?.level && Number(classEntry.level) < detail.prerequisite.level) return `${row.name} requires class level ${detail.prerequisite.level}.`;
      if (detail.prerequisite?.talent && !selected.includes(detail.prerequisite.talent)) return `${row.name} requires ${detail.prerequisite.talent}.`;
      if (detail.prerequisite?.pactBoon && !array(data.chosenOptionals).some((value) => String(value).toLowerCase().includes(detail.prerequisite.pactBoon))) return `${row.name} requires the ${detail.prerequisite.pactBoon} pact boon.`;
      if (detail.prerequisite?.cantrip) {
        const cantripIds = ids(selections[classEntry?.id]?.chosenCantrips);
        const eligible = cantripIds.some((cantripId) => {
          const spellRow = db.prepare("SELECT data_json FROM compendium_spells WHERE id = ? AND ruleset = ? AND level = 0").get(cantripId, args.ruleset) as { data_json: string } | undefined;
          const spell = spellRow ? parse(spellRow.data_json) : null;
          if (!spell) return false;
          const hasDamage = array(spell.rolls).some((roll) => roll?.effect === "damage" || array(roll?.effect).includes("damage"));
          const hasAttack = String(spell.check ?? "").toLowerCase().includes("attack") || array(spell.rolls).some((roll) => String(roll?.type ?? "").toLowerCase().includes("attack"));
          return detail.prerequisite.cantrip === "damage" ? hasDamage : hasDamage && hasAttack;
        });
        if (!eligible) return `${row.name} requires an eligible ${detail.prerequisite.cantrip.replace("_", " ")} cantrip.`;
      }
    }
  }
  for (const [category, kind] of [["maneuvers", "maneuver"], ["metamagic", "metamagic"], ["infusions", "infusion"]] as const) {
    for (const entry of array(prof[category])) {
      if (typeof entry?.id !== "string") continue;
      const row = db.prepare("SELECT kind FROM compendium_class_talents WHERE id = ? AND ruleset = ?").get(entry.id, args.ruleset) as { kind: string } | undefined;
      if (!row || row.kind !== kind) return `Selected ${kind} ${entry.id} does not exist in the ${args.ruleset} compendium.`;
    }
  }
  return null;
}
