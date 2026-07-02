import { api } from "@/services/api";

type CatalogFields =
  | "id"
  | "name"
  | "hd"
  | "size"
  | "speed"
  | "category"
  | "prerequisite"
  | "repeatable"
  | "abilities";

function withFields(path: string, fields: readonly CatalogFields[]): string {
  if (!fields.length) return path;
  const query = `fields=${encodeURIComponent(fields.join(","))}`;
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
}

export type ClassCatalogRow = {
  id: string;
  name: string;
  hd?: number | null;
};

export type RaceCatalogRow = {
  id: string;
  name: string;
  size?: string | null;
  speed?: number | null;
};

export type BackgroundCatalogRow = {
  id: string;
  name: string;
};

export type FeatCatalogRow = {
  id: string;
  name: string;
  category?: string | null;
  prerequisite?: string | null;
  repeatable?: boolean;
  abilities?: string[];
};

export function fetchClassCatalog(fields: readonly CatalogFields[] = ["id", "name", "hd"]) {
  return api<ClassCatalogRow[]>(withFields("/api/compendium/classes", fields));
}

export function fetchRaceCatalog(fields: readonly CatalogFields[] = ["id", "name", "size", "speed"]) {
  return api<RaceCatalogRow[]>(withFields("/api/compendium/races", fields));
}

export function fetchBackgroundCatalog(fields: readonly CatalogFields[] = ["id", "name"]) {
  return api<BackgroundCatalogRow[]>(withFields("/api/compendium/backgrounds", fields));
}

export function fetchFeatCatalog(fields: readonly CatalogFields[] = [
  "id",
  "name",
  "category",
  "prerequisite",
  "repeatable",
  "abilities",
]) {
  return api<FeatCatalogRow[]>(withFields("/api/compendium/feats", fields));
}

type JsonRecord = Record<string, any>;

export function classV2ToPlayer(entry: JsonRecord): JsonRecord {
  const proficiencies = entry.proficiencies ?? {};
  const spellcasting = entry.spellcasting ?? {};
  const tools = proficiencies.tools ?? { fixed: [], choices: [], notes: [] };
  const expandedTools = {
    fixed: Array.isArray(tools.fixed) ? tools.fixed : [],
    choices: Array.isArray(tools.choices) ? tools.choices : [],
    notes: Array.isArray(tools.notes) ? tools.notes : [],
  };
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    descriptions: entry.descriptions?.length ? entry.descriptions : (entry.description ? [entry.description] : []),
    hd: entry.hitDie,
    wealth: entry.startingWealth,
    proficiency: [...(proficiencies.savingThrows ?? []), ...(proficiencies.skills?.from ?? [])].join(", "),
    numSkills: proficiencies.skills?.choose ?? 0,
    armor: (proficiencies.armor ?? []).join(", "),
    weapons: (proficiencies.weapons ?? []).join(", "),
    tools: [
      ...expandedTools.fixed,
      ...expandedTools.choices.map((choice: JsonRecord) => `Choose ${choice.count} tool${choice.count === 1 ? "" : "s"}`),
      ...expandedTools.notes,
    ].join(", "),
    proficiencies: {
      ...proficiencies,
      tools: expandedTools,
    },
    spellAbility: spellcasting.ability,
    slotsReset: spellcasting.slotRecovery === "short_rest" ? "S" : "L",
    autolevels: (entry.levels ?? []).map((level: JsonRecord) => {
      const slotEntries = Object.entries(level.spellSlots ?? {}).map(([key, value]) => [Number(key), Number(value)] as const);
      const maxSlot = slotEntries.reduce((max, [slot]) => Math.max(max, slot), 0);
      return {
        level: level.level,
        scoreImprovement: level.abilityScoreImprovement === true,
        slots: maxSlot > 0
          ? [level.cantripsKnown ?? 0, ...Array.from({ length: maxSlot }, (_, index) => level.spellSlots?.[String(index + 1)] ?? 0)]
          : null,
        features: (level.features ?? []).map((feature: JsonRecord) => ({
          name: feature.name,
          text: feature.description,
          source: feature.source ?? null,
          subclass: feature.subclass ?? null,
          optional: feature.optional === true,
          effects: feature.effects ?? [],
          scalingRolls: feature.scalingRolls ?? [],
          preparedSpellProgression: feature.preparedSpellProgression ?? [],
          resolution: feature.resolution,
          resolutionNotes: feature.resolutionNotes ?? [],
        })),
        counters: (level.resources ?? []).map((resource: JsonRecord) => ({
          name: resource.name,
          value: resource.uses,
          reset: resource.recovery === "short_rest" ? "S" : "L",
          subclass: resource.subclass ?? null,
        })),
      };
    }),
  };
}

function traitsV2ToPlayer(traits: JsonRecord[]): JsonRecord[] {
  return traits.map((trait) => ({
    id: trait.id,
    name: trait.name,
    text: trait.description,
    category: trait.category,
    modifier: (trait.modifiers ?? []).map((modifier: JsonRecord) => String(modifier.value ?? "")),
    modifierDetails: trait.modifiers ?? [],
    scalingRolls: trait.scalingRolls ?? [],
    specials: trait.specials ?? [],
    proficiencies: trait.proficiencies ?? [],
    preparedSpellProgression: trait.preparedSpellProgression ?? [],
    resolution: trait.resolution,
    resolutionNotes: trait.resolutionNotes ?? [],
  }));
}

export async function fetchClassDetailV2<T>(id: string): Promise<T> {
  const canonical = await api<JsonRecord>(`/api/compendium/v2/classes/${encodeURIComponent(id)}`);
  return classV2ToPlayer(canonical) as T;
}

export async function fetchRaceDetailV2<T>(id: string): Promise<T> {
  const entry = await api<JsonRecord>(`/api/compendium/v2/species/${encodeURIComponent(id)}`);
  return {
    id: entry.id,
    name: entry.name,
    size: entry.size,
    speed: entry.speed,
    spellAbility: entry.spellcastingAbility,
    resist: (entry.resistances ?? []).join(", "),
    vision: entry.vision ?? [],
    parsedChoices: entry.choices ?? {},
    traits: traitsV2ToPlayer(entry.traits ?? []),
  } as T;
}

export function backgroundV2ToPlayer<T>(entry: JsonRecord): T {
  const proficiencies = entry.proficiencies ?? {};
  const expandChoice = (value: unknown) => {
    if (Array.isArray(value)) {
      return { fixed: value.map(String), choose: 0, from: null };
    }
    const choice = value && typeof value === "object" ? value as JsonRecord : {};
    const from = Array.isArray(choice.from) ? choice.from.map(String) : null;
    return {
      fixed: Array.isArray(choice.fixed) ? choice.fixed.map(String) : [],
      choose: typeof choice.choose === "number" ? choice.choose : 0,
      from: from?.length ? from : null,
    };
  };
  const expandFeatMechanics = (value: unknown, name: string): JsonRecord => {
    const parsed = value && typeof value === "object" ? value as JsonRecord : {};
    const grants = parsed.grants && typeof parsed.grants === "object" ? parsed.grants as JsonRecord : {};
    return {
      category: parsed.category ?? null,
      baseName: parsed.baseName ?? name,
      variant: parsed.variant ?? null,
      prerequisite: parsed.prerequisite ?? null,
      repeatable: parsed.repeatable === true,
      source: parsed.source ?? null,
      grants: {
        skills: Array.isArray(grants.skills) ? grants.skills : [],
        tools: Array.isArray(grants.tools) ? grants.tools : [],
        languages: Array.isArray(grants.languages) ? grants.languages : [],
        armor: Array.isArray(grants.armor) ? grants.armor : [],
        weapons: Array.isArray(grants.weapons) ? grants.weapons : [],
        savingThrows: Array.isArray(grants.savingThrows) ? grants.savingThrows : [],
        spells: Array.isArray(grants.spells) ? grants.spells : [],
        cantrips: Array.isArray(grants.cantrips) ? grants.cantrips : [],
        abilityIncreases: grants.abilityIncreases ?? {},
        bonuses: Array.isArray(grants.bonuses) ? grants.bonuses : [],
        effects: Array.isArray(grants.effects) ? grants.effects : [],
      },
      choices: Array.isArray(parsed.choices) ? parsed.choices : [],
      uses: Array.isArray(parsed.uses) ? parsed.uses : [],
      preparedSpellProgression: Array.isArray(parsed.preparedSpellProgression)
        ? parsed.preparedSpellProgression
        : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      modifierDetails: Array.isArray(parsed.modifierDetails) ? parsed.modifierDetails : [],
      ...(parsed.spellcastingAbility !== undefined
        ? { spellcastingAbility: parsed.spellcastingAbility }
        : {}),
      ...(parsed.spellcastingAbilityFromChoiceId !== undefined
        ? { spellcastingAbilityFromChoiceId: parsed.spellcastingAbilityFromChoiceId }
        : {}),
      ...(parsed.resolution !== undefined ? { resolution: parsed.resolution } : {}),
      ...(Array.isArray(parsed.resolutionNotes)
        ? { resolutionNotes: parsed.resolutionNotes }
        : {}),
    };
  };
  const feats = Array.isArray(proficiencies.feats)
    ? proficiencies.feats.map((feat: JsonRecord) => ({
        ...feat,
        parsed: expandFeatMechanics(feat.parsed, String(feat.name ?? "")),
      }))
    : [];
  const equipment = entry.equipment ?? {};
  const equipmentOptions = Array.isArray(equipment.options) ? equipment.options : [];
  const traits = [
    ...(typeof entry.description === "string" && entry.description
      ? [{ name: "Description", text: entry.description }]
      : []),
    ...feats.map((feat: JsonRecord) => ({
      name: `Feat: ${String(feat.name ?? "Feat")}`,
      text: String(feat.description ?? ""),
      scalingRolls: feat.scalingRolls ?? [],
      preparedSpellProgression: feat.preparedSpellProgression ?? [],
      resolution: feat.resolution,
    })),
    ...(Array.isArray(entry.traits) ? traitsV2ToPlayer(entry.traits) : []),
  ];
  return {
    id: entry.id,
    name: entry.name,
    source: entry.source,
    proficiency: "",
    description: entry.description ?? "",
    proficiencies: {
      skills: expandChoice(proficiencies.skills),
      tools: expandChoice(proficiencies.tools),
      languages: expandChoice(proficiencies.languages),
      feats,
      featChoice: typeof proficiencies.featChoice === "number" ? proficiencies.featChoice : 0,
      abilityScores: Array.isArray(proficiencies.abilityScores) ? proficiencies.abilityScores : [],
      abilityScoreChoose: typeof proficiencies.abilityScoreChoose === "number"
        ? proficiencies.abilityScoreChoose
        : 0,
    },
    equipment: typeof equipment.description === "string"
      ? equipment.description
      : equipmentOptions.length > 0 ? "Structured starting equipment" : "",
    equipmentOptions,
    traits,
  } as T;
}

export async function fetchBackgroundDetailV2<T>(id: string): Promise<T> {
  const entry = await api<JsonRecord>(`/api/compendium/v2/backgrounds/${encodeURIComponent(id)}`);
  return backgroundV2ToPlayer<T>(entry);
}
