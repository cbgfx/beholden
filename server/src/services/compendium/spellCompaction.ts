import { type JsonRecord, list, record } from "../../lib/jsonRecord.js";

function nonEmptyText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function compactComponents(value: unknown): JsonRecord | undefined {
  const components = record(value);
  const compact: JsonRecord = {};
  if (components.verbal === true) compact.verbal = true;
  if (components.somatic === true) compact.somatic = true;

  if (typeof components.material === "string") {
    compact.material = nonEmptyText(components.material) ?? true;
  } else if (components.material === true) {
    compact.material = true;
  } else {
    const material = record(components.material);
    if (material.required === true) {
      compact.material = nonEmptyText(material.description) ?? true;
    }
  }

  return Object.keys(compact).length > 0 ? compact : undefined;
}

function compactDuration(value: unknown): JsonRecord | undefined {
  const duration = record(value);
  const compact: JsonRecord = {};
  const description = nonEmptyText(duration.description);
  if (description) compact.description = description;
  if (duration.concentration === true) compact.concentration = true;
  return Object.keys(compact).length > 0 ? compact : undefined;
}

function compactCasting(value: unknown): JsonRecord | undefined {
  const casting = record(value);
  const compact: JsonRecord = {};
  const time = nonEmptyText(casting.time);
  const range = nonEmptyText(casting.range);
  const components = compactComponents(casting.components);
  const duration = compactDuration(casting.duration);
  if (time) compact.time = time;
  if (range) compact.range = range;
  if (components) compact.components = components;
  if (duration) compact.duration = duration;
  return Object.keys(compact).length > 0 ? compact : undefined;
}

export function compactSpellEntry(entry: JsonRecord): JsonRecord {
  const compact: JsonRecord = {
    id: entry.id,
    name: entry.name,
  };
  const source = nonEmptyText(entry.source);
  if (source) compact.source = source;
  if (typeof entry.level === "number") compact.level = entry.level;
  const school = nonEmptyText(entry.school);
  if (school) compact.school = school;

  const casting = compactCasting(entry.casting);
  if (casting) compact.casting = casting;
  if (entry.ritual === true) compact.ritual = true;

  const access = list(entry.access).map(String).filter(Boolean);
  if (access.length > 0) compact.access = access;
  if (Array.isArray(entry.check) && entry.check.length > 1) {
    compact.check = entry.check;
  } else if (["attack", "str", "dex", "con", "int", "wis", "cha"].includes(String(entry.check))) {
    compact.check = entry.check;
  }

  const rolls = list(entry.rolls).flatMap((raw) => {
    const roll = record(raw);
    const formula = nonEmptyText(roll.formula);
    if (!formula) return [];
    const compactRoll: JsonRecord = { formula };
    if (typeof roll.effect === "string" || (Array.isArray(roll.effect) && roll.effect.length > 1)) compactRoll.effect = roll.effect;
    const description = nonEmptyText(roll.description);
    if (description) compactRoll.description = description;
    if (typeof roll.level === "number") compactRoll.level = roll.level;
    return [compactRoll];
  });
  if (rolls.length > 0) compact.rolls = rolls;

  compact.description = list(entry.description).map(String).filter(Boolean);
  return compact;
}
