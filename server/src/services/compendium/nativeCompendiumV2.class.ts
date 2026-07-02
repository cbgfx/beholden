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

export function classFromV2(entry: JsonRecord): JsonRecord {
  const proficiencies = record(entry.proficiencies);
  const skills = record(proficiencies.skills);
  const spellcasting = record(entry.spellcasting);
  return {
    id: entry.id,
    name: entry.name,
    source: entry.source ?? null,
    description: entry.description,
    descriptions: entry.descriptions,
    hd: entry.hitDie,
    wealth: entry.startingWealth,
    spellAbility: spellcasting.ability,
    proficiencies: entry.proficiencies,
    proficiency: [
      ...list(proficiencies.savingThrows).map(String),
      ...list(skills.from).map(String),
    ].join(", "),
    numSkills: number(skills.choose) ?? 0,
    armor: list(proficiencies.armor).join(", "),
    weapons: list(proficiencies.weapons).join(", "),
    tools: (() => {
      const tools = proficiencies.tools;
      if (typeof tools === 'object' && tools && !Array.isArray(tools)) {
        const toolObj = record(tools);
        const parts = [];
        if (toolObj.fixed) parts.push(...list(toolObj.fixed));
        if (toolObj.choices) {
          parts.push(...list(toolObj.choices).map(c => {
            const choice = record(c);
            const count = number(choice.count) ?? 1;
            return `Choose ${count} tool${count > 1 ? 's' : ''}`;
          }));
        }
        if (toolObj.notes) parts.push(...list(toolObj.notes));
        return parts.join(', ');
      }
      if (Array.isArray(tools)) return tools.join(', ');
      return tools ? String(tools) : "";
    })(),
    slotsReset: spellcasting.slotRecovery === "short_rest" ? "S" : "L",
    autolevels: list(entry.levels).map((rawLevel) => {
      const level = record(rawLevel);
      const slots = record(level.spellSlots);
      const slotLevels = Object.keys(slots).map(Number).filter(Number.isFinite);
      const maxSlot = slotLevels.length > 0 ? Math.max(...slotLevels) : 0;
      return {
        level: level.level,
        scoreImprovement: level.abilityScoreImprovement === true,
        slots: maxSlot > 0
          ? [number(level.cantripsKnown) ?? 0, ...Array.from({ length: maxSlot }, (_, index) => number(slots[String(index + 1)]) ?? 0)]
          : null,
        features: list(level.features).map((rawFeature) => {
          const feature = record(rawFeature);
          return {
            name: feature.name,
            text: feature.description,
            source: feature.source ?? null,
            subclass: feature.subclass ?? null,
            optional: feature.optional === true,
            effects: [
              ...list(feature.effects),
              ...list(feature.scalingRolls).map((rawRoll) => {
                const roll = record(rawRoll);
                return {
                  kind: "source_roll",
                  description: roll.description ?? null,
                  level: roll.level ?? null,
                  value: roll.formula ?? "",
                };
              }),
            ],
            scalingRolls: feature.scalingRolls,
            preparedSpellProgression: feature.preparedSpellProgression,
            resolution: feature.resolution,
            resolutionNotes: list(feature.resolutionNotes),
          };
        }),
        counters: list(level.resources).map((rawResource) => {
          const resource = record(rawResource);
          return {
            name: resource.name,
            value: resource.uses,
            reset: resource.recovery === "short_rest" ? "S" : "L",
            subclass: resource.subclass ?? null,
          };
        }),
      };
    }),
  };
}
