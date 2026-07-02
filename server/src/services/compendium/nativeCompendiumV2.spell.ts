import { normalizeCanonicalSpell } from "./spellNormalization.js";
import { compactSpellEntry } from "./spellCompaction.js";
import { isCanonicalV2Entry } from "./nativeCompendiumV2Schemas.js";
import { type JsonRecord, record, list, text, number, split } from "./nativeCompendiumV2.helpers.js";

function parseComponents(value: unknown) {
  const raw = String(value ?? "");
  const material = raw.match(/M\s*(?:\((.*)\))?/iu);
  return {
    verbal: /(?:^|,\s*)V(?:,|$)/iu.test(raw),
    somatic: /(?:^|,\s*)S(?:,|$)/iu.test(raw),
    material: {
      required: /(?:^|,\s*)M(?:\s*\(|,|$)/iu.test(raw),
      description: material?.[1]?.trim() ?? null,
    },
  };
}

function componentsToLegacy(value: unknown): string | null {
  const components = record(value);
  const parts: string[] = [];
  if (components.verbal === true) parts.push("V");
  if (components.somatic === true) parts.push("S");
  if (typeof components.material === "string") {
    parts.push(`M (${components.material})`);
  } else if (components.material === true) {
    parts.push("M");
  } else {
    const material = record(components.material);
    if (material.required === true) {
      parts.push(material.description ? `M (${material.description})` : "M");
    }
  }
  return parts.join(", ") || null;
}

export function spellToV2(entry: JsonRecord): JsonRecord {
  if (isCanonicalV2Entry("spells", entry)) return entry;
  return compactSpellEntry(normalizeCanonicalSpell({
    id: text(entry.id),
    name: text(entry.name),
    source: text(entry.source),
    level: number(entry.level),
    school: text(entry.school),
    casting: {
      time: text(entry.time),
      range: text(entry.range),
      components: parseComponents(entry.components),
      duration: {
        description: text(entry.duration),
        concentration: entry.concentration === true,
      },
    },
    ritual: entry.ritual === true,
    classes: split(entry.classes),
    tags: list(entry.tags),
    rolls: list(entry.rolls).flatMap((raw) => {
      const roll = record(raw);
      const formula = text(roll.formula ?? roll["#text"] ?? raw);
      if (!formula) return [];
      const level = number(roll.level ?? roll["@_level"]);
      return [{
        description: text(roll.description ?? roll["@_description"]),
        scaling: level == null ? null : number(entry.level) === 0 ? "character_level" : "slot_level",
        level,
        formula,
      }];
    }),
    description: Array.isArray(entry.text)
      ? entry.text.map(String)
      : text(entry.text) ? [String(entry.text)] : [],
  }));
}

export function spellFromV2(entry: JsonRecord): JsonRecord {
  const canonical = compactSpellEntry(normalizeCanonicalSpell(entry));
  const casting = record(canonical.casting);
  const duration = record(casting.duration);
  return {
    id: canonical.id,
    name: canonical.name,
    source: canonical.source ?? null,
    level: canonical.level ?? null,
    school: canonical.school ?? null,
    time: casting.time,
    range: casting.range,
    components: componentsToLegacy(casting.components),
    duration: duration.description,
    concentration: duration.concentration === true,
    ritual: canonical.ritual === true,
    classes: [...list(canonical.classes), ...list(canonical.tags)].join(", "),
    tags: list(canonical.tags),
    rolls: list(canonical.rolls).map((raw) => {
      const roll = record(raw);
      return {
        description: roll.description ?? null,
        scaling: roll.scaling ?? null,
        level: roll.level ?? null,
        formula: roll.formula ?? "",
      };
    }),
    text: list(canonical.description).map(String),
  };
}
