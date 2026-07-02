export type FeatResolution = "automatic" | "manual" | "mixed";

import { type JsonRecord, record, list } from "./jsonRecord.js";

const REVIEWED_AUTOMATIC_FEATS = new Set([
  "Ability Score Improvement",
  "Fighting Style: Archery",
  "Fighting Style: Blessed Warrior",
  "Fighting Style: Blind Fighting",
  "Fighting Style: Defense",
  "Fighting Style: Dueling",
  "Fighting Style: Thrown Weapon Fighting",
  "Fighting Style: Two-Weapon Fighting",
  "Origin: Tough",
]);

function hasValues(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value && typeof value === "object" && Object.keys(value).length > 0);
}

function isManualEffect(value: unknown): boolean {
  const effect = record(value);
  return effect.resolution === "manual"
    || (effect.type === "narrative" && effect.category === "manual_resolution");
}

export function classifyFeatResolution(
  name: string,
  mechanicsValue: unknown,
): { resolution: FeatResolution; resolutionNotes: string[] } {
  const mechanics = record(mechanicsValue);
  const grants = record(mechanics.grants);
  const effects = list(grants.effects);
  const manualEffects = effects.filter(isManualEffect);
  const automaticEffects = effects.filter((effect) => !isManualEffect(effect));
  const hasAutomaticData = automaticEffects.length > 0
    || list(mechanics.choices).length > 0
    || list(mechanics.uses).length > 0
    || list(mechanics.preparedSpellProgression).length > 0
    || Object.entries(grants).some(([key, value]) => key !== "effects" && hasValues(value));
  const manualNotes = manualEffects
    .map((value) => {
      const effect = record(value);
      return String(effect.summary ?? effect.description ?? "").trim();
    })
    .filter(Boolean);

  if (hasAutomaticData && manualEffects.length > 0) {
    return {
      resolution: "mixed",
      resolutionNotes: manualNotes.length > 0
        ? manualNotes
        : ["Some benefits are automatic; remaining effects require manual resolution."],
    };
  }
  if (manualEffects.length > 0) {
    return {
      resolution: "manual",
      resolutionNotes: manualNotes.length > 0
        ? manualNotes
        : ["This feat requires manual resolution."],
    };
  }
  if (hasAutomaticData && REVIEWED_AUTOMATIC_FEATS.has(name)) {
    return { resolution: "automatic", resolutionNotes: [] };
  }
  if (hasAutomaticData) {
    return {
      resolution: "mixed",
      resolutionNotes: [
        "Structured benefits are automatic; remaining feat prose requires manual resolution until reviewed.",
      ],
    };
  }
  return {
    resolution: "manual",
    resolutionNotes: ["No deterministic mechanics are encoded; resolve this feat manually."],
  };
}

export function withFeatResolution<T extends JsonRecord>(name: string, mechanics: T): T & {
  resolution: FeatResolution;
  resolutionNotes: string[];
} {
  return {
    ...mechanics,
    ...classifyFeatResolution(name, mechanics),
  };
}
