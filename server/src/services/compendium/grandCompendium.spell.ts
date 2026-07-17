import { type JsonRecord, record, list } from "./grandCompendium.helpers.js";

function formatComponents(value: unknown): string | null {
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

export function projectGrandSpell(entry: JsonRecord): JsonRecord {
  const canonical = entry;
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
    components: formatComponents(casting.components),
    duration: duration.description,
    concentration: duration.concentration === true,
    ritual: canonical.ritual === true,
    classes: list(canonical.access).join(", "),
    check: canonical.check ?? null,
    rolls: list(canonical.rolls).map((raw) => {
      const roll = record(raw);
      return {
        description: roll.description ?? null,
        effect: roll.effect ?? null,
        level: roll.level ?? null,
        formula: roll.formula ?? "",
      };
    }),
    text: list(canonical.description).map(String),
  };
}
