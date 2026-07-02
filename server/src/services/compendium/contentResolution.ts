export type ContentResolution = "automatic" | "manual" | "mixed";

import { type JsonRecord, record } from "../../lib/jsonRecord.js";

const REDUNDANT_RESOLUTION_NOTES = new Set([
  "Structured benefits are applied where supported; remaining prose requires manual resolution.",
  "No deterministic mechanics are encoded; resolve this feature manually.",
]);

function notes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(String).filter((note) => note && !REDUNDANT_RESOLUTION_NOTES.has(note))
    : [];
}

export function withContentResolution<T extends JsonRecord>(
  value: T,
  hasStructuredMechanics: boolean,
): Omit<T, "resolution" | "resolutionNotes"> & {
  resolution: ContentResolution;
  resolutionNotes?: string[];
} {
  const explicit = value.resolution;
  const resolutionNotes = notes(value.resolutionNotes);
  const { resolution: _resolution, resolutionNotes: _resolutionNotes, ...content } = value;
  if (explicit === "automatic" || explicit === "manual" || explicit === "mixed") {
    return {
      ...content,
      resolution: explicit,
      ...(resolutionNotes.length > 0 ? { resolutionNotes } : {}),
    };
  }
  return {
    ...content,
    resolution: hasStructuredMechanics ? "mixed" : "manual",
  };
}

export function hasStructuredTraitMechanics(value: unknown): boolean {
  const trait = record(value);
  return ["modifiers", "scalingRolls", "specials", "proficiencies", "preparedSpellProgression"]
    .some((key) => Array.isArray(trait[key]) && trait[key].length > 0);
}

export function hasStructuredClassFeatureMechanics(value: unknown): boolean {
  const feature = record(value);
  return ["effects", "scalingRolls", "preparedSpellProgression"]
    .some((key) => Array.isArray(feature[key]) && feature[key].length > 0);
}
