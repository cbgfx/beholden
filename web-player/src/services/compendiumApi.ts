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

export type Ruleset = "5e" | "5.5e";

function withFields(path: string, fields: readonly CatalogFields[]): string {
  if (!fields.length) return path;
  const query = `fields=${encodeURIComponent(fields.join(","))}`;
  return path.includes("?") ? `${path}&${query}` : `${path}?${query}`;
}

function withRuleset(path: string, ruleset: Ruleset | undefined): string {
  if (!ruleset) return path;
  const query = `ruleset=${encodeURIComponent(ruleset)}`;
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

export function fetchClassCatalog(ruleset?: Ruleset, fields: readonly CatalogFields[] = ["id", "name", "hd"]) {
  return api<ClassCatalogRow[]>(withRuleset(withFields("/api/compendium/classes", fields), ruleset));
}

export function fetchRaceCatalog(ruleset?: Ruleset, fields: readonly CatalogFields[] = ["id", "name", "size", "speed"]) {
  return api<RaceCatalogRow[]>(withRuleset(withFields("/api/compendium/races", fields), ruleset));
}

export function fetchBackgroundCatalog(ruleset?: Ruleset, fields: readonly CatalogFields[] = ["id", "name"]) {
  return api<BackgroundCatalogRow[]>(withRuleset(withFields("/api/compendium/backgrounds", fields), ruleset));
}

export function fetchFeatCatalog(ruleset?: Ruleset, fields: readonly CatalogFields[] = [
  "id",
  "name",
  "category",
  "prerequisite",
  "repeatable",
  "abilities",
]) {
  return api<FeatCatalogRow[]>(withRuleset(withFields("/api/compendium/feats", fields), ruleset));
}

type JsonRecord = Record<string, any>;

export function classGrandToPlayerView(entry: JsonRecord): JsonRecord {
  const proficiencies = entry.proficiencies ?? {};
  const spellcasting = entry.spellcasting ?? {};
  const tools = proficiencies.tools ?? { fixed: [], choices: [], notes: [] };
  const expandedTools = {
    fixed: Array.isArray(tools.fixed) ? tools.fixed : [],
    choices: Array.isArray(tools.choices) ? tools.choices : [],
    notes: Array.isArray(tools.notes) ? tools.notes : [],
  };
  const subclassNames = entry.subclasses?.options && typeof entry.subclasses.options === "object"
    ? Object.fromEntries(Object.entries(entry.subclasses.options as Record<string, string | JsonRecord>).map(([id, value]) => [id, typeof value === "string" ? value : value.name]))
    : {};
  const choiceFeatureIds = new Set<string>((entry.choices ?? []).flatMap((choice: JsonRecord) =>
    (choice.options ?? []).flatMap((option: JsonRecord) => option.features ?? []).map(String)));
  return {
    id: entry.id,
    name: entry.name,
    subclasses: entry.subclasses ? { ...entry.subclasses, options: subclassNames } : null,
    subclassDetails: entry.subclasses?.options ?? {},
    choices: entry.choices ?? [],
    primaryAbility: entry.primaryAbility,
    multiclass: entry.multiclass ?? null,
    equipmentOptions: entry.equipment?.options ?? [],
    spellLists: entry.spellLists ?? {},
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
    spellcastingList: spellcasting.list ?? null,
    slotsReset: spellcasting.slotRecovery === "short_rest" ? "S" : "L",
    preparedSpellChanges: spellcasting.preparedSpellChanges ?? null,
    preparedSpellFormula: spellcasting.preparedFormula ?? null,
    autolevels: (entry.levels ?? []).map((level: JsonRecord) => {
      const slotEntries = Object.entries(level.spellSlots ?? {}).map(([key, value]) => [Number(key), Number(value)] as const);
      const maxSlot = slotEntries.reduce((max, [slot]) => Math.max(max, slot), 0);
      return {
        level: level.level,
        scoreImprovement: level.abilityScoreImprovement === true,
        spellsPrepared: level.spellsPrepared ?? null,
        slots: maxSlot > 0
          ? [level.cantripsKnown ?? 0, ...Array.from({ length: maxSlot }, (_, index) => level.spellSlots?.[String(index + 1)] ?? 0)]
          : null,
        features: (level.features ?? []).map((feature: JsonRecord) => ({
          id: feature.id,
          name: feature.name,
          text: feature.description,
          source: feature.source ?? null,
          subclass: feature.subclass ? (subclassNames[feature.subclass] ?? feature.subclass) : null,
          subclassId: feature.subclass ?? null,
          optional: choiceFeatureIds.has(String(feature.id)),
          effects: feature.effects ?? [],
          scalingRolls: feature.scalingRolls ?? [],
          preparedSpellProgression: feature.preparedSpellProgression ?? [],
          resolution: feature.resolution,
          resolutionNotes: feature.resolutionNotes ?? [],
          talent: feature.talent ?? null,
          choices: feature.choices ?? [],
          noteTemplate: feature.noteTemplate ?? null,
        })),
        counters: (level.resources ?? []).map((resource: JsonRecord) => ({
          name: resource.name,
          value: resource.uses,
          reset: resource.recovery === "short_rest" ? "S" : "L",
          subclass: resource.subclass ? (subclassNames[resource.subclass] ?? resource.subclass) : null,
          subclassId: resource.subclass ?? null,
        })),
      };
    }),
  };
}

function traitsGrandToPlayerView(traits: JsonRecord[]): JsonRecord[] {
  return traits.map((trait) => ({
    id: trait.id,
    name: trait.name,
    text: trait.description,
    modifier: (trait.modifiers ?? []).map((modifier: JsonRecord) => String(modifier.value ?? "")),
    modifierDetails: trait.modifiers ?? [],
    scalingRolls: trait.scalingRolls ?? [],
    specials: trait.specials ?? [],
    proficiencies: trait.proficiencies ?? [],
    preparedSpellProgression: trait.preparedSpellProgression ?? [],
    effects: trait.effects ?? [],
    resolution: trait.resolution,
    resolutionNotes: trait.resolutionNotes ?? [],
  }));
}

export async function fetchGrandClassDetail<T>(id: string, ruleset: Ruleset): Promise<T> {
  const canonical = await api<JsonRecord>(`/api/compendium/canonical/classes/${encodeURIComponent(id)}?ruleset=${ruleset}`);
  return classGrandToPlayerView(canonical) as T;
}

export async function fetchGrandSpeciesDetail<T>(id: string, ruleset: Ruleset): Promise<T> {
  const entry = await api<JsonRecord>(`/api/compendium/canonical/species/${encodeURIComponent(id)}?ruleset=${ruleset}`);
  return {
    id: entry.id,
    name: entry.name,
    size: entry.size,
    speed: entry.speed,
    creatureType: entry.creatureType ?? "Humanoid",
    spellAbility: entry.spellcastingAbility,
    abilityScoreIncrease: entry.abilityScoreIncrease ?? null,
    parsedChoices: entry.choices ?? {},
    traits: traitsGrandToPlayerView(entry.traits ?? []),
  } as T;
}

export function backgroundGrandToPlayerView<T>(entry: JsonRecord, resolvedFeats: JsonRecord[] = []): T {
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
  const resolvedFeatById = new Map(resolvedFeats.map((feat) => [String(feat.id), feat]));
  const fixedFeatIds = typeof proficiencies.feat === "string" ? [proficiencies.feat] : [];
  const feats = fixedFeatIds
    .flatMap((value: unknown) => {
        const feat = typeof value === "string" ? resolvedFeatById.get(value) : value as JsonRecord;
        return feat ? [{ ...feat, parsed: expandFeatMechanics(feat.parsed, String(feat.name ?? "")) }] : [];
      });
  const featChoice = typeof proficiencies.featChoice === "number"
    ? { count: proficiencies.featChoice, from: [] }
    : proficiencies.featChoice && typeof proficiencies.featChoice === "object"
      ? { count: Number(proficiencies.featChoice.count ?? 0), from: Array.isArray(proficiencies.featChoice.from) ? proficiencies.featChoice.from : [] }
      : { count: 0, from: [] };
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
    ...(Array.isArray(entry.traits) ? traitsGrandToPlayerView(entry.traits) : []),
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
      featChoice: featChoice.count,
      featChoiceFrom: featChoice.from,
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

export async function fetchGrandBackgroundDetail<T>(id: string, ruleset: Ruleset): Promise<T> {
  const entry = await api<JsonRecord>(`/api/compendium/canonical/backgrounds/${encodeURIComponent(id)}?ruleset=${ruleset}`);
  const featIds = typeof entry.proficiencies?.feat === "string" ? [entry.proficiencies.feat] : [];
  const feats = await Promise.all(featIds.map((featId: string) =>
    api<JsonRecord>(`/api/compendium/feats/${encodeURIComponent(featId)}?ruleset=${ruleset}`)));
  return backgroundGrandToPlayerView<T>(entry, feats);
}
