import { parseClassTools } from "../../lib/proficiencyConstants.js";
import { withContentResolution } from "./contentResolution.js";
import { isCanonicalV2Entry } from "./nativeCompendiumV2Schemas.js";
import { type JsonRecord, ABILITY_NAMES, record, list, text, number, abilityKey, split } from "./nativeCompendiumV2.helpers.js";
import { compactClassEntry } from "./classCompaction.js";

function classProficiencies(entry: JsonRecord) {
  const tokens = split(entry.proficiency);
  const savingThrows: string[] = [];
  const skillOptions: string[] = [];
  for (const token of tokens) {
    const ability = ABILITY_NAMES.get(token.toLowerCase());
    if (ability) savingThrows.push(ability);
    else skillOptions.push(token);
  }
  return {
    savingThrows,
    skills: { choose: number(entry.numSkills) ?? 0, from: skillOptions },
    armor: split(entry.armor),
    weapons: split(entry.weapons),
    tools: parseClassTools(String(entry.tools ?? "")),
  };
}

export function classToV2(entry: JsonRecord): JsonRecord {
  if (isCanonicalV2Entry("classes", entry)) return entry;
  const byLevel = new Map<number, JsonRecord>();
  for (const raw of list(entry.autolevels)) {
    const level = record(raw);
    const levelNumber = number(level.level);
    if (levelNumber == null) continue;
    const current = byLevel.get(levelNumber) ?? {
      level: levelNumber,
      abilityScoreImprovement: false,
      cantripsKnown: null,
      spellSlots: {},
      features: [],
      resources: [],
    };
    current.abilityScoreImprovement = current.abilityScoreImprovement === true || level.scoreImprovement === true;
    const slots = list(level.slots).map(Number);
    if (slots.length > 0) {
      current.cantripsKnown = Number.isFinite(slots[0]) ? slots[0] : null;
      current.spellSlots = Object.fromEntries(slots.slice(1).map((count, index) => [String(index + 1), count]));
    }
    const existingFeatures = list(current.features);
    current.features = [
      ...existingFeatures,
      ...list(level.features).map((rawFeature, index) => {
        const feature = record(rawFeature);
        const effects = list(feature.effects);
        const scalingRolls = effects
          .map(record)
          .filter((effect) => effect.kind === "source_roll")
          .flatMap((effect) => {
            const formula = text(effect.value);
            if (!formula) return [];
            return [{
              description: text(effect.description),
              level: number(effect.level),
              formula,
            }];
          });
        return withContentResolution({
          id: text(feature.id) ?? `level_${levelNumber}_feature_${existingFeatures.length + index + 1}`,
          name: text(feature.name) ?? "Feature",
          description: text(feature.text) ?? "",
          optional: feature.optional === true,
          source: text(feature.source),
          subclass: text(feature.subclass),
          effects: effects.filter((effect) => record(effect).kind !== "source_roll"),
          scalingRolls,
          preparedSpellProgression: list(feature.preparedSpellProgression),
        }, effects.length > 0 || scalingRolls.length > 0 || list(feature.preparedSpellProgression).length > 0);
      }),
    ];
    current.resources = [
      ...list(current.resources),
      ...list(level.counters).map((rawCounter) => {
        const counter = record(rawCounter);
        return {
          name: text(counter.name) ?? "Resource",
          uses: number(counter.value) ?? 0,
          recovery: counter.reset === "S" ? "short_rest" : "long_rest",
          subclass: text(counter.subclass),
        };
      }),
    ];
    byLevel.set(levelNumber, current);
  }
  return compactClassEntry({
    id: text(entry.id),
    name: text(entry.name),
    source: text(entry.source),
    description: text(entry.description) ?? "",
    descriptions: list(entry.descriptions).length > 0
      ? list(entry.descriptions).map(String)
      : [text(entry.description) ?? ""].filter(Boolean),
    hitDie: number(entry.hd),
    startingWealth: number(entry.wealth),
    proficiencies: classProficiencies(entry),
    spellcasting: {
      ability: abilityKey(entry.spellAbility),
      slotRecovery: entry.slotsReset === "S" ? "short_rest" : "long_rest",
    },
    levels: Array.from(byLevel.values()).sort((a, b) => Number(a.level) - Number(b.level)),
  });
}

