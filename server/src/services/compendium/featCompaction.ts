import { type JsonRecord, list, record } from "../../lib/jsonRecord.js";

const REDUNDANT_RESOLUTION_NOTES = new Set([
  "Structured benefits are automatic; remaining feat prose requires manual resolution until reviewed.",
  "No deterministic mechanics are encoded; resolve this feat manually.",
  "Manual resolution required.",
]);

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export type CanonicalFeatCategory = "O" | "G" | "E" | "F";

const CATEGORY_CODES: Record<string, CanonicalFeatCategory> = {
  O: "O", Origin: "O",
  G: "G", General: "G",
  E: "E", "Epic Boon": "E",
  F: "F", "Fighting Style": "F",
};

const CATEGORY_LABELS: Record<CanonicalFeatCategory, string> = {
  O: "Origin", G: "General", E: "Epic Boon", F: "Fighting Style",
};

export function canonicalFeatCategory(entry: JsonRecord): CanonicalFeatCategory {
  const explicit = text(entry.category ?? record(entry.mechanics).category);
  if (explicit && CATEGORY_CODES[explicit]) return CATEGORY_CODES[explicit];
  return "G";
}

export function featCategoryLabel(value: unknown): string {
  return CATEGORY_LABELS[CATEGORY_CODES[String(value ?? "")] ?? "G"];
}

export function featPrerequisiteLabel(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return `Level ${value}+`;
  const facts = record(value);
  const parts: string[] = [];
  if (facts.level) parts.push(`Level ${facts.level}+`);
  const ability = record(facts.ability);
  if (Array.isArray(ability.any)) parts.push(`${ability.any.map((key) => String(key).toUpperCase()).join(" or ")} ${ability.min ?? 13}+`);
  if (facts.class) parts.push(`${String(facts.class)} class`);
  if (facts.feature) parts.push(String(facts.feature).replaceAll("_", " "));
  if (facts.training) parts.push(String(facts.training).replaceAll("_", " "));
  if (facts.feat || facts.anyOfFeats) parts.push("required Feat");
  if (facts.noneOfFeats) parts.push("no other Dragonmark Feat");
  if (facts.campaign) parts.push(`${facts.campaign} campaign`);
  if (facts.any) parts.push("one listed requirement");
  return parts.join(", ");
}

function compactValue(value: unknown, key = ""): unknown {
  if (value == null || value === false) return undefined;
  if (Array.isArray(value)) {
    const compact = value
      .map((item) => compactValue(item))
      .filter((item) => item !== undefined);
    if (key === "resolutionNotes") {
      const useful = compact.filter((item) => !REDUNDANT_RESOLUTION_NOTES.has(String(item)));
      return useful.length > 0 ? useful : undefined;
    }
    return compact.length > 0 ? compact : undefined;
  }
  if (typeof value === "object") {
    const compact = Object.fromEntries(
      Object.entries(value as JsonRecord)
        .flatMap(([childKey, childValue]) => {
          const child = compactValue(childValue, childKey);
          return child === undefined ? [] : [[childKey, child]];
        }),
    );
    return Object.keys(compact).length > 0 ? compact : undefined;
  }
  return value;
}

export function compactFeatMechanics(mechanics: JsonRecord): JsonRecord {
  const {
    category: _category,
    source: _source,
    prerequisite: _prerequisite,
    repeatable: _repeatable,
    resolution: _resolution,
    resolutionNotes: _resolutionNotes,
    baseName: _baseName,
    variant: _variant,
    notes: _notes,
    modifierDetails: _modifierDetails,
    ...mechanicalData
  } = mechanics;
  const compact = record(compactValue(mechanicalData));
  if (Array.isArray(compact.uses)) {
    compact.uses = compact.uses.map((value) => {
      const use = { ...record(value) };
      if (use.recharge === "long_rest") delete use.recharge;
      return use;
    });
  }
  return compact;
}

export function compactFeatEntry(entry: JsonRecord): JsonRecord {
  const mechanics = compactFeatMechanics(record(entry.mechanics));
  const compact: JsonRecord = {
    id: entry.id,
    ruleset: entry.ruleset ?? "5.5e",
    name: entry.name,
  };
  const source = text(entry.source);
  if (source) compact.source = source;
  const category = canonicalFeatCategory(entry);
  if (category !== "G") compact.category = category;
  if (entry.prerequisite != null) compact.prerequisite = entry.prerequisite;
  if (entry.repeatable === true) compact.repeatable = true;
  compact.description = String(entry.description ?? "");
  if (["automatic", "manual", "mixed"].includes(String(entry.resolution))) {
    compact.resolution = entry.resolution;
  }
  const resolutionNotes = list(entry.resolutionNotes)
    .map(String)
    .filter((note) => note && !REDUNDANT_RESOLUTION_NOTES.has(note));
  if (resolutionNotes.length > 0) compact.resolutionNotes = resolutionNotes;
  if (Object.keys(mechanics).length > 0) compact.mechanics = mechanics;
  return compact;
}

export function expandFeatMechanics(
  mechanicsValue: unknown,
  entry: JsonRecord = {},
): JsonRecord {
  const mechanics = record(mechanicsValue);
  const grants = record(mechanics.grants);
  const resolutionNotes = list(
    mechanics.resolutionNotes ?? entry.resolutionNotes,
  ).map(String);
  return {
    category: mechanics.category ?? entry.category ?? null,
    baseName: mechanics.baseName ?? entry.name ?? "",
    variant: mechanics.variant ?? null,
    prerequisite: mechanics.prerequisite ?? entry.prerequisite ?? null,
    repeatable: mechanics.repeatable === true || entry.repeatable === true,
    source: mechanics.source ?? entry.source ?? null,
    grants: {
      skills: list(grants.skills).map(String),
      tools: list(grants.tools).map(String),
      languages: list(grants.languages).map(String),
      armor: list(grants.armor).map(String),
      weapons: list(grants.weapons).map(String),
      savingThrows: list(grants.savingThrows).map(String),
      spells: list(grants.spells).map(String),
      cantrips: list(grants.cantrips).map(String),
      abilityIncreases: record(grants.abilityIncreases),
      bonuses: list(grants.bonuses),
      effects: list(grants.effects),
    },
    choices: list(mechanics.choices),
    uses: list(mechanics.uses),
    preparedSpellProgression: list(mechanics.preparedSpellProgression),
    notes: list(mechanics.notes).map(String),
    modifierDetails: list(mechanics.modifierDetails),
    rolls: list(mechanics.rolls),
    ...(mechanics.spellcastingAbility !== undefined
      ? { spellcastingAbility: mechanics.spellcastingAbility }
      : {}),
    ...(mechanics.spellcastingAbilityFromChoiceId !== undefined
      ? { spellcastingAbilityFromChoiceId: mechanics.spellcastingAbilityFromChoiceId }
      : {}),
    ...(mechanics.resolution !== undefined || entry.resolution !== undefined
      ? { resolution: mechanics.resolution ?? entry.resolution }
      : {}),
    ...(resolutionNotes.length > 0 ? { resolutionNotes } : {}),
  };
}
