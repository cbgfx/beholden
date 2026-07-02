import { type JsonRecord, record, list } from "../../lib/jsonRecord.js";

const SCHOOL_NAMES: Record<string, string> = {
  A: "Abjuration",
  ABJURATION: "Abjuration",
  C: "Conjuration",
  CONJURATION: "Conjuration",
  D: "Divination",
  DIVINATION: "Divination",
  EN: "Enchantment",
  ENCHANTMENT: "Enchantment",
  EV: "Evocation",
  EVOCATION: "Evocation",
  I: "Illusion",
  ILLUSION: "Illusion",
  N: "Necromancy",
  NECROMANCY: "Necromancy",
  T: "Transmutation",
  TRANSMUTATION: "Transmutation",
};

function isSpellTag(value: string): boolean {
  return [
    "Artificer Infusions",
    "Eldritch Invocations",
    "Maneuver Options",
    "Metamagic Options",
    "Ritual Caster",
    "Touch Spells",
  ].includes(value) || /^Mages of Strixhaven\b/u.test(value);
}

function clean(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/gu, " ").trim();
  return text || null;
}

function quantity(value: string, singular: string, plural: string): string {
  const match = value.match(/^(\d+)\s+/u);
  if (!match?.[1]) return value;
  const amount = Number(match[1]);
  return `${amount} ${amount === 1 ? singular : plural}`;
}

export function normalizeSpellSchool(value: unknown): string | null {
  const normalized = clean(value)?.toUpperCase();
  return normalized ? SCHOOL_NAMES[normalized] ?? null : null;
}

export function normalizeSpellCastingTime(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  return raw
    .replace(/^Bonus Action,\s*Bonus Action,/iu, "Bonus Action,")
    .replace(/^(?:\d+\s+)?bonus action\b/iu, "Bonus Action")
    .replace(/^(?:\d+\s+)?action\b/iu, "Action")
    .replace(/^(?:\d+\s+)?reaction\b/iu, "Reaction")
    .replace(/^(\d+)\s+minute(?:s)?\b/iu, (_, amount: string) =>
      quantity(`${amount} minute`, "Minute", "Minutes"))
    .replace(/^(\d+)\s+hour(?:s)?\b/iu, (_, amount: string) =>
      quantity(`${amount} hour`, "Hour", "Hours"))
    .replace(/,\s*Which\b/u, ", which");
}

export function normalizeSpellRange(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  return raw
    .replace(/^(\d+)\s+feet\b/iu, "$1 feet")
    .replace(/^(\d+)\s+miles?\b/iu, (_, amount: string) =>
      `${amount} ${Number(amount) === 1 ? "Mile" : "Miles"}`)
    .replace(/^self\b/iu, "Self")
    .replace(/^touch$/iu, "Touch")
    .replace(/^sight$/iu, "Sight")
    .replace(/^unlimited$/iu, "Unlimited");
}

function normalizeDurationAmount(value: string): string {
  return value
    .replace(/^(\d+)\s+round(?:s)?$/iu, (_, amount: string) =>
      quantity(`${amount} round`, "Round", "Rounds"))
    .replace(/^(\d+)\s+minute(?:s)?$/iu, (_, amount: string) =>
      quantity(`${amount} minute`, "Minute", "Minutes"))
    .replace(/^(\d+)\s+hour(?:s)?$/iu, (_, amount: string) =>
      quantity(`${amount} hour`, "Hour", "Hours"))
    .replace(/^(\d+)\s+day(?:s)?$/iu, (_, amount: string) =>
      quantity(`${amount} day`, "Day", "Days"));
}

export function normalizeSpellDuration(value: unknown): string | null {
  const raw = clean(value);
  if (!raw) return null;
  if (/^instantaneous\b/iu.test(raw)) {
    const [, suffix = ""] = raw.match(/^instantaneous(.*)$/iu) ?? [];
    return `Instantaneous${suffix ? `, ${normalizeDurationAmount(suffix.replace(/^,\s*/u, ""))}` : ""}`;
  }
  if (/^until dispelled$/iu.test(raw)) return "Until Dispelled";
  const concentration = raw.match(/^concentration,\s*up to\s+(.+)$/iu);
  if (concentration?.[1]) {
    return `Concentration, up to ${normalizeDurationAmount(concentration[1])}`;
  }
  return normalizeDurationAmount(raw);
}

export function sourceFromSpellDescription(value: unknown): string | null {
  const text = list(value).map(String).join("\n");
  const match = text.match(/(?:^|\n)Source:\s*([\s\S]+)$/iu);
  return match?.[1]
    ? match[1].replace(/\s+/gu, " ").replace(/,\s*$/u, "").trim() || null
    : null;
}

export function normalizeCanonicalSpell(entry: JsonRecord): JsonRecord {
  const casting = record(entry.casting);
  const duration = record(casting.duration);
  const rawClasses = list(entry.classes).map(String);
  const schoolFromClasses = rawClasses
    .map((value) => value.match(/^School:\s*(.+)$/iu)?.[1] ?? null)
    .find(Boolean);
  const tags = [...new Set([
    ...list(entry.tags).map(String),
    ...rawClasses.filter(isSpellTag),
  ].map((value) => value.trim()).filter(Boolean))];
  const classes = [...new Set(rawClasses
    .filter((value) => !/^School:/iu.test(value) && !isSpellTag(value))
    .map((value) => value.trim())
    .filter(Boolean))];
  const rawDescription = list(entry.description).map(String);
  const source = clean(entry.source) ?? sourceFromSpellDescription(rawDescription);
  const description = rawDescription.map((line) => line.replace(/(?:^|\n)Source:\s*[^\n]+\s*$/iu, "").trim()).filter(Boolean);
  return {
    ...entry,
    source,
    school: normalizeSpellSchool(entry.school ?? schoolFromClasses),
    casting: {
      ...casting,
      time: normalizeSpellCastingTime(casting.time),
      range: normalizeSpellRange(casting.range),
      duration: {
        ...duration,
        description: normalizeSpellDuration(duration.description),
        concentration: duration.concentration === true
          || /^concentration,/iu.test(String(duration.description ?? "")),
      },
    },
    classes,
    tags,
    description,
  };
}
